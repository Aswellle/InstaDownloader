import { BrowserWindow, nativeTheme, session } from 'electron'

/**
 * Instagram 登录窗口（docs/11：凭据仅本地加密保存）。
 *
 * 实现方式：打开一个受控的独立 BrowserWindow 加载 Instagram 官方登录页，
 * 用户在真实页面上登录（凭据直接提交给 Instagram，本应用不接触密码），
 * 登录成功后从该窗口的 Electron session 中读取 instagram.com 的 Cookie，
 * 交给 SettingsService 经 safeStorage 加密后仅存本机。
 *
 * 安全性：不注入脚本读取密码、不拦截请求体；仅读取 Cookie 分区，
 * 与浏览器"已登录"状态等价。
 */

const LOGIN_PARTITION = 'persist:ig-login'
const LOGIN_URL = 'https://www.instagram.com/accounts/login/'
const SESSION_COOKIE = 'sessionid'
const X_IG_APP_ID = '936619743392459'
const LOGIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** 隐藏窗口单飞互斥：同一时刻只允许一个隐藏 BrowserWindow 在登录分区上
 *  抓取。并发的 profile 归档 / 剪贴板自动解析 / 手动解析会各自开窗，
 *  等于同时以同一登录身份高频访问 IG —— 重则触发会话风控失效
 *  （"Heavy scraping invalidates the session"）。所有触发隐藏窗口的
 *  操作经此串行化，代价是排队等待。 */
let windowChain: Promise<unknown> = Promise.resolve()
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = windowChain.then(fn, fn)
  windowChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

/** 从分区中提取 instagram.com 的 Cookie 头字符串。
 *  注意：Electron 的 cookies.get({domain}) 是**精确匹配**，不会做后缀匹配，
 *  而 IG 的 cookie 可能挂在 .instagram.com / www.instagram.com / i.instagram.com
 *  等多个域上。因此这里拉取全部分区 cookie 再按域名后缀过滤。 */
async function readIgCookies(partition: string): Promise<string> {
  const ses = session.fromPartition(partition)
  const all = await ses.cookies.get({})
  const igCookies = all.filter((c) => {
    const d = (c.domain || '').replace(/^\./, '').toLowerCase()
    return d === 'instagram.com' || d.endsWith('.instagram.com')
  })
  return igCookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

import type { Locale } from '@shared/types'

export interface LoginResult {
  ok: boolean
  /** 是否确认已认证（接口验证通过） */
  hasSession: boolean
  /** 已登录的用户名（验证通过时返回） */
  username?: string
  /** 已登录用户的头像 URL */
  avatar?: string
  cookie?: string
  cancelled?: boolean
  /** 失败原因码：文案由渲染层按当前语言解析，主进程不持有用户可见文案 */
  reason?: 'timeout' | 'incomplete'
}

/** 判定登录态的页面内探针。
 *
 *  为什么不看 innerText：现代 IG 网页版左侧导航是**纯图标**，文字只在
 *  aria-label 里，innerText 根本不含"首页/搜索/探索"，按文案判定永远为假。
 *  这里读 DOM 结构：登录表单、主导航链接、以及**带头像的 profile 链接**。
 *
 *  两个必须排除的假阳性（都踩过坑）：
 *  1. 登录墙上的推荐账号（如 /popular/）会被误认成"当前用户"；
 *  2. 账号选择屏（"继续 / 使用其他主页 / 创建新账户"）表示会话不完整，
 *     此时 IG 已记住用户名但 sessionid 无效，不能算已登录。
 *
 *  返回 JSON 字符串（executeJavaScript 的返回值需可序列化）。 */
const PROBE_JS = `(() => {
  const doc = document
  const hasLoginForm = !!(
    doc.querySelector('input[name="username"]') ||
    doc.querySelector('input[name="password"]') ||
    /\\/accounts\\/login/.test(location.pathname)
  )
  const text = doc.body ? (doc.body.innerText || '') : ''
  // 账号选择屏：会话不完整（有 ds_user_id 但 sessionid 失效）
  const hasAccountSelector =
    /使用其他主页|Use another profile/i.test(text) &&
    /创建新账户|Create new account/i.test(text)
  // 安全挑战页：IG 要求先处理安全提示（如"邮箱可能不安全"）才放行。
  // 注意：能跳到挑战页恰恰说明**会话有效**（未登录会被送去登录页），
  // 因此这不算"未认证"，只是需要用户在窗口里完成一次确认。
  const hasSecurityChallenge =
    /\\/challenge|update_risky_contactpoint|\\/accounts\\/edit/.test(location.pathname + location.search) ||
    /你的邮箱可能不安全|Your email may be at risk|确认你的身份|Confirm your identity/i.test(text)
  // 这些路径不是用户名
  const reserved = new Set(['explore','reels','reel','direct','accounts','stories','p','tv','about','legal','api','web','challenge','emails','session','developer','privacy','terms','directory','locations','nametag','settings','oauth','graphql','ajax','friendships','invites','notifications','your_activity','professional_dashboard','edits','archive','popular'])
  // 当前用户 = 侧栏里**同时含用户名链接与头像 img** 的那个链接。
  // 注意不能用"页面上最后一张 cdninstagram 图"兜底：登录墙的推荐缩略图
  // 会让判定变成假阳性（曾把未登录状态误判为已登录）。
  let username = null
  let avatar = null
  for (const a of doc.querySelectorAll('a[href]')) {
    const m = /^\\/([A-Za-z0-9._]+)\\/?$/.exec(a.getAttribute('href') || '')
    if (!m) continue
    const name = m[1]
    if (reserved.has(name.toLowerCase())) continue
    const img = a.querySelector('img')
    if (img && img.src) { username = name; avatar = img.src; break }
  }
  // 已登录导航结构：主导航出现探索/私信链接
  const hasNav = !!doc.querySelector('a[href="/explore/"], a[href="/direct/inbox/"], a[href^="/direct/"]')
  // 登录后的引导弹层（"保存登录信息"）同样是已认证状态
  const hasSaveInfo = /保存登录信息|Save your login info/i.test(text)
  return JSON.stringify({ hasLoginForm, hasAccountSelector, hasSecurityChallenge, hasNav, hasSaveInfo, username, avatar })
})()`

interface ProbeResult {
  hasLoginForm: boolean
  hasAccountSelector: boolean
  hasSecurityChallenge: boolean
  hasNav: boolean
  hasSaveInfo: boolean
  username: string | null
  avatar: string | null
}

/** 在指定 webContents 上执行探针（页面导航中会抛错，调用方忽略即可） */
async function probePage(wc: Electron.WebContents): Promise<ProbeResult | null> {
  if (wc.isDestroyed()) return null
  try {
    // executeJavaScript 在页面繁忙时可能长时间不返回，加超时兜底。
    // 不检查 isLoading：IG 是重资源 SPA，主框架"加载中"时 DOM 往往已可用。
    const raw = (await Promise.race([
      wc.executeJavaScript(PROBE_JS, true) as Promise<string>,
      new Promise<null>((r) => setTimeout(() => r(null), 10000))
    ])) as string | null
    if (!raw) return null
    return JSON.parse(raw) as ProbeResult
  } catch {
    return null
  }
}

/** 由探针结果判定是否已认证（用于关闭登录窗口 / 标记已登录）。
 *
 *  必须排除：登录表单（未登录）、账号选择屏（会话不完整）、安全挑战页。
 *
 *  为什么挑战页也算"未完成"：IG 在会话有效但要求用户确认安全信息时
 *  （如"邮箱可能不安全"）会拦截所有页面。此时若判定为已登录，登录窗口
 *  会立刻关闭，用户反而没机会处理这个提示。因此保持窗口打开，让用户在
 *  页面里完成确认；确认后 IG 跳回信息流，那时才算真正完成。 */
function isAuthenticated(p: ProbeResult): boolean {
  if (p.hasLoginForm || p.hasAccountSelector || p.hasSecurityChallenge) return false
  return !!(p.username || p.hasNav || p.hasSaveInfo)
}

/** 会话在"需要用户处理安全提示"的意义上是否有效（用于状态展示，
 *  不用于关闭登录窗口）。能到挑战页说明 cookie 是有效的。 */
export function sessionLooksValid(p: ProbeResult | null): boolean {
  if (!p) return false
  if (p.hasLoginForm || p.hasAccountSelector) return false
  return !!(p.username || p.hasNav || p.hasSaveInfo || p.hasSecurityChallenge)
}

/**
 * 确认分区会话是否**真正已认证**，并提取当前登录用户的资料。
 *
 * 为什么不用 API：Instagram 已弃用旧的 REST 端点（/api/v1/accounts/current_user/
 * 现在对浏览器上下文也返回 HTML 壳页）。可靠且稳定的判定方式是**检测页面
 * 渲染状态**（见 PROBE_JS）。
 *
 * 返回 valid=true 表示会话可用，并尽量带上用户名/头像供 UI 展示。
 */
async function verifyAuthenticatedImpl(): Promise<{
  valid: boolean
  username?: string
  avatar?: string
}> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      partition: LOGIN_PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  const finish = (r: { valid: boolean; username?: string; avatar?: string }) => {
    if (!win.isDestroyed()) win.close()
    return r
  }
  try {
    await win.loadURL('https://www.instagram.com/')
    // 等待 IG 前端完成初始化与登录态渲染
    await new Promise((r) => setTimeout(r, 4000))
    const p = await probePage(win.webContents)
    if (!p) return finish({ valid: false })
    const valid = isAuthenticated(p)
    return finish({
      valid,
      username: p.username ?? undefined,
      avatar: p.avatar ?? undefined
    })
  } catch {
    return finish({ valid: false })
  }
}

/** 导出的抓取入口一律走单飞互斥（见 serialized 说明） */
function verifyAuthenticated(): Promise<{ valid: boolean; username?: string; avatar?: string }> {
  return serialized(verifyAuthenticatedImpl)
}

/**
 * 打开登录窗口并等待用户完成登录。
 * 返回提取到的 Cookie（若成功）或取消信息。
 */
export function openInstagramLogin(
  parent: BrowserWindow | null,
  locale: Locale = 'zh-CN'
): Promise<LoginResult> {
  return new Promise((resolve) => {
    const ses = session.fromPartition(LOGIN_PARTITION)
    // 使用桌面版 UA，避免被引导到 App 下载页
    ses.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    )

    const loginWin = new BrowserWindow({
      width: 560,
      height: 820,
      minWidth: 480,
      minHeight: 640,
      parent: parent ?? undefined,
      modal: false,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff',
      title: locale === 'zh-CN' ? '登录 Instagram' : 'Log in to Instagram',
      webPreferences: {
        partition: LOGIN_PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // 登录页需要正常加载第三方资源
        webSecurity: true
      }
    })

    let settled = false
    const finish = (result: LoginResult) => {
      if (settled) return
      settled = true
      clearInterval(poller)
      clearTimeout(timeout)
      if (!loginWin.isDestroyed()) loginWin.close()
      resolve(result)
    }

    // 登录成功判定：不能只看 cookie 是否存在 —— Instagram 在用户提交凭据但
    // 尚未完成安全确认（设备验证 / 可疑登录）时就会下发 sessionid，
    // 此时页面仍停留在验证流程，未进入已登录的信息流。
    // 因此必须**检测页面渲染状态**：直接探测用户正在操作的这个窗口本身
    // （比另开隐藏窗口更快、更准，也避免额外加载）。
    let verifying = false
    const poller = setInterval(async () => {
      if (verifying || settled) return
      verifying = true
      try {
        const cookie = await readIgCookies(LOGIN_PARTITION)
        const hasSessionCookie = cookie
          .split('; ')
          .some((kv) => kv.startsWith(`${SESSION_COOKIE}=`))
        if (!hasSessionCookie) return
        const p = await probePage(loginWin.webContents)
        if (p && isAuthenticated(p)) {
          finish({
            ok: true,
            hasSession: true,
            cookie,
            username: p.username ?? undefined,
            avatar: p.avatar ?? undefined
          })
        }
        // 未认证（可能仍在二次验证）：继续等待用户完成页面上的确认步骤
      } catch {
        /* 分区尚未就绪或页面导航中，忽略 */
      } finally {
        verifying = false
      }
    }, 2000)

    // 超时保护（8 分钟，给二次验证留足时间）
    const timeout = setTimeout(
      () =>
        finish({
          ok: false,
          hasSession: false,
          reason: 'timeout'
        }),
      8 * 60 * 1000
    )

    loginWin.on('ready-to-show', () => loginWin.show())
    loginWin.on('closed', () => {
      if (settled) return
      // 用户手动关闭窗口：可能在关闭前一刻才登录成功（关得快、轮询没赶上），
      // 因此用同一套 DOM 探针做最后一次确认（另开隐藏窗口加载首页）。
      void verifyAuthenticated()
        .then(async (check) => {
          if (!check.valid) {
            finish({ ok: false, hasSession: false, cancelled: true })
            return
          }
          const cookie = await readIgCookies(LOGIN_PARTITION)
          finish({
            ok: true,
            hasSession: true,
            cookie,
            username: check.username,
            avatar: check.avatar
          })
        })
        .catch(() => finish({ ok: false, hasSession: false, cancelled: true }))
    })

    void loginWin.loadURL(LOGIN_URL)

    // 忽略证书/权限弹窗，保持流程顺畅
    loginWin.webContents.setWindowOpenHandler(({ url }) => {
      // 站内跳转在本窗口继续。必须按 hostname 判断而不是子串包含：
      // /instagram\.com/.test() 会放行 "https://evil.com/?x=instagram.com"
      // 与 "https://instagram.com.evil.com/"，把登录窗口导航到钓鱼页。
      try {
        const host = new URL(url).hostname.toLowerCase()
        if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
          void loginWin.loadURL(url)
        }
      } catch {
        /* 非法 URL 忽略 */
      }
      return { action: 'deny' }
    })
  })
}

/**
 * 用 ds_user_id 反查用户名（安全挑战页没有 profile 链接时用）。
 * 走公开的 web_profile 页面（worker 同一路径），不需要私有接口。
 */
export async function resolveUsernameFromCookie(): Promise<string> {
  const cookie = await readIgCookies(LOGIN_PARTITION)
  const dsUserId = cookie
    .split('; ')
    .find((kv) => kv.startsWith('ds_user_id='))
    ?.split('=')[1]
  if (!dsUserId) return ''
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      partition: LOGIN_PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  try {
    await win.loadURL('https://www.instagram.com/')
    await new Promise((r) => setTimeout(r, 4000))
    // 页面内联数据里通常带 viewer 的用户名
    const js = `(() => {
      const html = document.documentElement.outerHTML
      const m = /"viewer"\\s*:\\s*\\{[^}]*?"username"\\s*:\\s*"([A-Za-z0-9._]+)"/.exec(html)
      if (m) return m[1]
      const m2 = /"username"\\s*:\\s*"([A-Za-z0-9._]+)"[^}]{0,200}?"id"\\s*:\\s*"${dsUserId}"/.exec(html)
      if (m2) return m2[1]
      return ''
    })()`
    const raw = (await win.webContents.executeJavaScript(js, true)) as string
    return raw || ''
  } catch {
    return ''
  } finally {
    if (!win.isDestroyed()) win.close()
  }
}

/** 清除登录分区（用于"退出登录"） */
export async function clearInstagramLoginSession(): Promise<void> {
  const ses = session.fromPartition(LOGIN_PARTITION)
  await ses.clearStorageData({ storages: ['cookies'] })
}

export interface ProfileShortcodes {
  ok: boolean
  shortcodes: string[]
  /** 页面最终停在登录墙：分区会话不可用（区别于加载失败） */
  notLoggedIn?: boolean
  error?: string
}

/**
 * 在已登录的浏览器里打开主页，提取帖子 shortcode 列表。
 *
 * 为什么用这条路：IG 已对网页端关闭 /api/v1/feed/user/ 与 /api/graphql
 * （实测均返回 text/html 壳页，即便在页面上下文内发起、带真实 LSD token）。
 * 但页面本身能正常渲染，因此改为**读取页面渲染结果**——与用户手动浏览
 * 所见一致，属独立实现，不复制任何私有接口。
 *
 * 拿到 shortcode 后，媒体本体走既有的公开 embed 解析（docs/dev/06），
 * 无需登录即可取到原始画质。
 *
 * minCount：滚动加载到收集满该数量为止（或连续两轮无增长视为到底）。
 * 由调用方按需递增，避免"每翻一页都从主页顶部完整重放"的二次方成本。
 */
export function listProfileShortcodes(
  username: string,
  minCount = 12
): Promise<ProfileShortcodes> {
  return serialized(() => listProfileShortcodesImpl(username, minCount))
}

async function listProfileShortcodesImpl(
  username: string,
  minCount: number
): Promise<ProfileShortcodes> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      partition: LOGIN_PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  try {
    // IG 在频繁访问时会直接重置连接（ERR_CONNECTION_CLOSED），需要重试
    let loaded = false
    let lastErr = ''
    for (let attempt = 0; attempt < 3 && !loaded; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2500 * attempt))
        await win.loadURL(`https://www.instagram.com/${encodeURIComponent(username)}/`)
        loaded = true
      } catch (e) {
        lastErr = String(e).slice(0, 120)
      }
    }
    if (!loaded) return { ok: false, shortcodes: [], error: lastErr || 'load failed' }
    // 页面被重定向到登录墙：分区会话不可用（资料页对未登录也可见，
    // 但帖子网格不会渲染，继续等只会空转）
    if (/\/accounts\/login/i.test(win.webContents.getURL())) {
      return { ok: false, shortcodes: [], notLoggedIn: true }
    }
    // IG 的帖子网格由 JS 异步填充，固定等待不可靠：轮询直到出现链接。
    // 上限要放宽：数千万粉丝级的重主页（如 natgeo）冷渲染远超 20s，
    // 轮询太短会把"还在渲染"误判为"用户不存在"。
    const js = `(async () => {
      // 注意：IG 的帖子链接是**绝对 URL**（https://www.instagram.com/p/XXX/），
      // 因此正则不能锚定行首的 "/p/"，否则一个都匹配不到。
      const collect = () => {
        const out = []
        for (const a of document.querySelectorAll('a[href]')) {
          const m = /\\/(?:p|reel|tv)\\/([A-Za-z0-9_-]{5,})/.exec(a.getAttribute('href') || '')
          if (m) out.push(m[1])
        }
        return out
      }
      // 轮询等待网格渲染（最多 ~45s）
      let codes = collect()
      for (let i = 0; i < 45 && codes.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        codes = collect()
      }
      // 滚动加载直到收集满 minCount，或连续两轮无增长（到底/隐藏加载）
      let stall = 0
      while (codes.length < ${Math.max(1, Math.floor(minCount))} && stall < 2) {
        window.scrollTo(0, document.body.scrollHeight)
        await new Promise((r) => setTimeout(r, 1800))
        const next = collect()
        if (next.length === codes.length) stall += 1
        else stall = 0
        codes = next
      }
      return JSON.stringify([...new Set(codes)])
    })()`
    const raw = (await Promise.race([
      win.webContents.executeJavaScript(js, true) as Promise<string>,
      new Promise<null>((r) => setTimeout(() => r(null), 90000))
    ])) as string | null
    if (!raw) return { ok: false, shortcodes: [], error: 'timeout' }
    return { ok: true, shortcodes: JSON.parse(raw) as string[] }
  } catch (e) {
    return { ok: false, shortcodes: [], error: String(e).slice(0, 160) }
  } finally {
    if (!win.isDestroyed()) win.close()
  }
}

/** 该分区是否已有登录态（供 UI 展示） */
export async function hasInstagramLoginSession(): Promise<boolean> {
  const cookie = await readIgCookies(LOGIN_PARTITION)
  return cookie.split('; ').some((kv) => kv.startsWith(`${SESSION_COOKIE}=`))
}

/**
 * 把已持久化的 Cookie 串注回分区。
 *
 * 为什么需要：Electron 的 persist: 分区 cookie 由 Chromium 异步刷盘，
 * 进程被强杀（或异常退出）时可能丢失；而 safeStorage 的 session.bin 是
 * 同步写入的，因此它才是可靠的副本。启动时若发现分区缺 sessionid，
 * 用 session.bin 注回即可恢复登录态，无需用户重新登录。
 */
export async function restoreSessionToPartition(cookieString: string): Promise<boolean> {
  const pairs = cookieString
    .split(';')
    .map((kv) => kv.trim())
    .filter(Boolean)
    .map((kv) => {
      const i = kv.indexOf('=')
      return i > 0 ? { name: kv.slice(0, i), value: kv.slice(i + 1) } : null
    })
    .filter((x): x is { name: string; value: string } => !!x)
  if (pairs.length === 0) return false

  const ses = session.fromPartition(LOGIN_PARTITION)
  const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
  let ok = 0
    for (const { name, value } of pairs) {
      for (const domain of ['.instagram.com', 'www.instagram.com']) {
        try {
          await ses.cookies.set({
            url: 'https://www.instagram.com/',
            name,
            value,
            domain,
            path: '/',
            secure: true,
            // sessionid 是凭据本体：恢复时保持 httpOnly，页面脚本不可读
            // （IG 原生下发的该 cookie 即为 httpOnly）。csrftoken 等
            // IG 前端自身需要 JS 读取的 cookie 保持可读，避免破坏页面。
            httpOnly: name === 'sessionid',
            expirationDate: expiry
          })
          ok++
          break
        } catch {
          /* 单个 cookie 失败不影响其余 */
        }
      }
    }
  // 写盘，确保重启后仍在
  await ses.cookies.flushStore().catch(() => {})
  return ok > 0
}

/**
 * 自愈：分区里已有可用会话，但主进程尚未持久化时补写。
 *
 * 场景：用户登录成功了，但成功判定因页面结构变化没触发（或应用在
 * 判定前被关闭），此时会话其实有效。启动时调用一次，避免用户白登录。
 * 返回 null 表示分区无会话或会话已失效。
 */
export async function recoverPartitionSession(): Promise<{
  cookie: string
  username?: string
  avatar?: string
} | null> {
  if (!(await hasInstagramLoginSession())) return null
  const check = await verifyAuthenticated()
  if (!check.valid) return null
  const cookie = await readIgCookies(LOGIN_PARTITION)
  if (!cookie.split('; ').some((kv) => kv.startsWith(`${SESSION_COOKIE}=`))) return null
  return { cookie, username: check.username, avatar: check.avatar }
}

/**
 * 在已登录浏览器里读取用户公开资料（DOM 兜底）。
 *
 * 为什么需要：worker 的 `get_user` 走 Python + 爬虫 UA 抓页面，IG 会对
 * 该指纹返回空壳页（表现为 "user xxx not found"），而浏览器上下文正常。
 * 这里从渲染后的页面读 og 元数据与内联 JSON，作为资料解析的兜底路径。
 */
export function fetchProfileInBrowser(username: string): Promise<{
  user_id: string
  username: string
  full_name: string
  avatar: string
  followers: number
  posts: number
  is_private: boolean
  is_verified: boolean
} | null> {
  return serialized(() => fetchProfileInBrowserImpl(username))
}

async function fetchProfileInBrowserImpl(username: string): Promise<{
  user_id: string
  username: string
  full_name: string
  avatar: string
  followers: number
  posts: number
  is_private: boolean
  is_verified: boolean
} | null> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      partition: LOGIN_PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  try {
    await win.loadURL(`https://www.instagram.com/${encodeURIComponent(username)}/`)
    await new Promise((r) => setTimeout(r, 5000))
    const js = `(() => {
      const meta = (p) => {
        const el = document.querySelector('meta[property="' + p + '"]')
        return el ? (el.getAttribute('content') || '') : ''
      }
      const text = document.body ? (document.body.innerText || '') : ''
      // 页面文案里的计数（如 "3.2万帖子" / "32K posts" / "2.6亿粉丝"）
      const parseCount = (label) => {
        const m = new RegExp('([0-9.,]+)\\\\s*([万亿KMB]?)\\\\s*(?:' + label + ')').exec(text)
        if (!m) return 0
        const num = parseFloat(m[1].replace(/,/g, ''))
        if (!isFinite(num)) return 0
        const unit = m[2]
        const mult = unit === '万' ? 1e4 : unit === '亿' ? 1e8 : unit === 'K' ? 1e3 : unit === 'M' ? 1e6 : unit === 'B' ? 1e9 : 1
        return Math.round(num * mult)
      }
      const html = document.documentElement.outerHTML
      const anchor = '"username":"' + ${JSON.stringify(username)} + '"'
      const i = html.indexOf(anchor)
      const scope = i >= 0 ? html.slice(i, i + 6000) : html
      const grab = (re) => { const m = re.exec(scope); return m ? m[1] : '' }
      const unesc = (v) => { try { return JSON.parse('"' + v + '"') } catch { return v } }
      return JSON.stringify({
        user_id: grab(/"user_id":"([0-9]+)"/) || grab(/"id":"([0-9]+)"/),
        full_name: unesc(grab(/"full_name":"([^"]*)"/)),
        avatar: unesc(grab(/"profile_pic_url_hd":"([^"]+)"/) || grab(/"profile_pic_url":"([^"]+)"/)),
        ogImage: meta('og:image'),
        ogDesc: meta('og:description'),
        followers: parseCount('粉丝|followers'),
        posts: parseCount('帖子|posts'),
        isPrivate: /"is_private":true/.test(scope),
        isVerified: /"is_verified":true/.test(scope),
        hasGrid: !!document.querySelector('a[href*="/p/"], a[href*="/reel/"]')
      })
    })()`
    const raw = (await Promise.race([
      win.webContents.executeJavaScript(js, true) as Promise<string>,
      new Promise<null>((r) => setTimeout(() => r(null), 20000))
    ])) as string | null
    if (!raw) return null
    const p = JSON.parse(raw) as {
      user_id: string
      full_name: string
      avatar: string
      ogImage: string
      ogDesc: string
      followers: number
      posts: number
      isPrivate: boolean
      isVerified: boolean
      hasGrid: boolean
    }
    // 页面完全无内容 → 账号不存在或会话被 IG 拦截（会重定向到首页）
    if (!p.user_id && !p.full_name && !p.ogDesc && !p.hasGrid) return null
    return {
      user_id: p.user_id,
      username,
      full_name: p.full_name,
      avatar: p.avatar || p.ogImage || '',
      followers: p.followers,
      posts: p.posts,
      is_private: p.isPrivate,
      is_verified: p.isVerified
    }
  } catch {
    return null
  } finally {
    if (!win.isDestroyed()) win.close()
  }
}

export { LOGIN_PARTITION }
