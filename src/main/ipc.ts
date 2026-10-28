import { BrowserWindow, app, dialog, ipcMain, clipboard, shell, nativeTheme } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isProbablyIgUrl, classifyIgUrl } from '@shared/ig-url'
import { themeColorsFor } from '@shared/theme'
import type {
  MediaCollection,
  ProfileUser,
  TaskEvent,
  AppError,
  AppSettings,
  Locale
} from '@shared/types'
import type { Repos, TaskRow } from './db/repos'
import type { WorkerManager } from './services/worker-manager'
import type { SettingsService } from './services/settings'
import type { TaskManager, EnqueueItem } from './services/queue'
import { planPath, extFromUrl } from './services/files'
import { toIpcHandler } from './ipc-helpers'
import { setUiLocale, uiLocale } from './services/ui-locale'
import { mediaRowsFromItems } from './services/media-rows'
import { ProfileArchive } from './services/profile-archive'
import {
  openInstagramLogin,
  clearInstagramLoginSession,
  hasInstagramLoginSession,
  recoverPartitionSession,
  restoreSessionToPartition,
  resolveUsernameFromCookie
} from './services/ig-login'

export interface IpcDeps {
  win: () => BrowserWindow | null
  worker: WorkerManager
  repos: Repos
  settings: SettingsService
  tasks: TaskManager
}

const WORKER_ERROR_TO_APP: Record<string, AppError['code']> = {
  E_INVALID_URL: 'E_INVALID_URL',
  E_PARSE_FAILED: 'E_PARSE_FAILED',
  E_IG_RATE_LIMIT: 'E_IG_RATE_LIMIT',
  E_IG_LOGIN_REQUIRED: 'E_IG_LOGIN_REQUIRED',
  E_IG_PRIVATE: 'E_IG_PRIVATE',
  E_IG_NOT_FOUND: 'E_IG_NOT_FOUND',
  E_WORKER_DOWN: 'E_WORKER_DOWN',
  E_NETWORK: 'E_NETWORK',
}

function toAppError(e: unknown): AppError {
  const err = e as { code?: string; message?: string }
  const code = (err?.code && WORKER_ERROR_TO_APP[err.code]) || 'E_NETWORK'
  return { code, message: err?.message ?? 'unknown error' }
}

function rowToSnapshot(t: TaskRow) {
  return {
    id: t.id,
    mediaId: t.media_id,
    url: t.url,
    author: t.author ?? '',
    type: (t.type as 'image' | 'video') ?? 'image',
    shortcode: t.shortcode ?? '',
    indexNo: t.index_no ?? 0,
    status: t.status,
    progress: t.progress,
    speed: t.speed,
    downloaded: t.downloaded,
    total: t.total,
    destPath: t.dest_path ?? '',
    error: t.error,
    createdAt: t.created_at,
    updatedAt: t.updated_at
  }
}

export function registerIpc(deps: IpcDeps): void {
  const { win, worker, repos, settings, tasks } = deps

  /** 主页归档服务：延迟装配（ig-login 仅在 Electron 运行时可用，且保持
   *  动态 import 规避与主入口的循环依赖）；逻辑与测试都在 service 层。 */
  let archive: ProfileArchive | null = null
  const getProfileArchive = async (): Promise<ProfileArchive> => {
    if (!archive) {
      const dom = await import('./services/ig-login')
      archive = new ProfileArchive(worker, repos, dom)
    }
    return archive
  }

  // 任务事件 → 渲染进程（progress 200ms 节流）
  const lastSent = new Map<string, number>()
  tasks.setEmitter((ev: TaskEvent) => {
    if (ev.kind === 'progress') {
      const now = Date.now()
      if (now - (lastSent.get(ev.id) ?? 0) < 200) return
      lastSent.set(ev.id, now)
    } else {
      lastSent.delete(ev.id)
    }
    win()?.webContents.send('task:event', ev)
  })

  const handle = (channel: string, fn: (...args: never[]) => unknown): void => {
    // 必须剥离 Electron 传入的 event 参数（见 ipc-helpers.ts 的回归说明）
    ipcMain.handle(channel, toIpcHandler(fn as (...args: unknown[]) => unknown) as never)
  }

  /** file:open / file:reveal 的路径白名单：位于下载目录内，或已记录在
   *  下载历史中。渲染层是安全边界——被攻破时不能借这两个通道用系统
   *  默认程序打开任意文件（.exe/.bat 会被直接执行）。 */
  const isKnownDownloadPath = (p: string): boolean => {
    if (!p || !existsSync(p)) return false
    const dir = settings.get().downloadDir
    if (dir && (p === dir || p.startsWith(dir + '\\') || p.startsWith(dir + '/'))) return true
    return repos.hasHistoryPath(p)
  }

  // 渲染层语言切换时同步到主进程（原生对话框/系统通知文案跟随）
  handle('window:setLocale', (locale: Locale) => {
    if (locale === 'zh-CN' || locale === 'en') setUiLocale(locale)
  })

  // ------------------------------------------------------------ 解析
  handle('parse:url', async (url: string) => {
    if (!isProbablyIgUrl(url)) {
      return { error: { code: 'E_INVALID_URL', message: 'not an instagram url' } as AppError }
    }
    const info = classifyIgUrl(url)
    try {
      if (info.kind === 'profile') {
        // 先用 worker（Python + 爬虫 UA）；IG 会对其返回空壳页，此时回退到
        // 已登录浏览器读渲染结果（浏览器上下文稳定可用）。
        let user: ProfileUser | null = null
        try {
          const r = await worker.call<{ user: ProfileUser }>('get_user', {
            username: info.username
          })
          user = r.user
        } catch {
          /* 交给下面的浏览器兜底 */
        }
        if (!user || (!user.user_id && !user.full_name && !user.avatar)) {
          const { fetchProfileInBrowser } = await import('./services/ig-login')
          user = (await fetchProfileInBrowser(info.username!)) ?? user
        }
        if (!user) {
          return {
            error: { code: 'E_IG_NOT_FOUND', message: `user ${info.username} not found` } as AppError
          }
        }
        return { kind: 'profile', user }
      }
      if (info.kind === 'story') {
        const r = await worker.call<MediaCollection>('resolve_story', { username: info.username! })
        for (const row of mediaRowsFromItems(r.items, { author: r.author.username, shortcode: info.username! })) {
          repos.upsertMedia(row)
        }
        return { kind: 'collection', collection: r }
      }
      if (info.kind === 'post' || info.kind === 'reel' || info.kind === 'tv') {
        const r = await worker.call<MediaCollection>('resolve_post', { shortcode: info.shortcode })
        for (const row of mediaRowsFromItems(r.items, {
          author: r.author.username,
          shortcode: info.shortcode!
        })) {
          repos.upsertMedia(row)
        }
        return { kind: 'collection', collection: r }
      }
      return { error: { code: 'E_INVALID_URL', message: `unsupported: ${info.kind}` } as AppError }
    } catch (e) {
      return { error: toAppError(e) }
    }
  })

  handle('user:media', async (username: string, maxId?: string) => {
    // IG 已对网页端关闭 feed 端点（实测返回 HTML 壳页），worker 路径每页
    // 都要白付一轮限流重试才落到这里 —— 直接走 DOM 归档路径。
    const archive = await getProfileArchive()
    try {
      const r = await archive.getProfileMedia(username, maxId)
      if (r.ok) return r
      const code: AppError['code'] =
        r.reason === 'not-logged-in' ? 'E_IG_LOGIN_REQUIRED'
        : r.reason === 'not-found' ? 'E_IG_NOT_FOUND'
        : 'E_NETWORK'
      const message =
        r.reason === 'not-logged-in' ? 'login required'
        : r.reason === 'not-found' ? `user ${username} not found`
        : 'profile media unavailable'
      return { error: { code, message } as AppError }
    } catch (e) {
      return { error: toAppError(e) }
    }
  })

  handle('user:search', async (username: string) => {
    try {
      const r = await worker.call<{ user: ProfileUser }>('get_user', { username })
      return { user: r.user }
    } catch (e) {
      return { error: toAppError(e) }
    }
  })

  // ------------------------------------------------------------ 下载
  handle(
    'download:add',
    (
      items: Array<{
        id: string
        type: 'image' | 'video'
        url: string
        thumbUrl?: string | null
        author: string
        shortcode: string
        indexNo: number
        takenAt?: number | null
        width?: number | null
        height?: number | null
        duration?: number | null
      }>
    ) => {
      const dir = settings.get().downloadDir
      const enqueue: EnqueueItem[] = items.map((m) => {
        const index = m.indexNo > 1 ? `_${m.indexNo}` : ''
        const base = `${m.author}_${m.shortcode || m.id}${index}`
        const dest = planPath({
          root: dir,
          author: m.author,
          takenAt: m.takenAt,
          type: m.type,
          base,
          ext: extFromUrl(m.url, m.type)
        })
        repos.upsertMedia({
          id: m.id,
          platform: 'instagram',
          shortcode: m.shortcode,
          author: m.author,
          url: m.url,
          thumb_url: m.thumbUrl ?? null,
          type: m.type,
          width: m.width ?? null,
          height: m.height ?? null,
          duration: m.duration ?? null,
          caption: null,
          taken_at: m.takenAt ?? null,
          created_at: Date.now()
        })
        return {
          mediaId: m.id,
          url: m.url,
          author: m.author,
          type: m.type,
          shortcode: m.shortcode,
          indexNo: m.indexNo,
          takenAt: m.takenAt ?? null,
          destPath: dest
        }
      })
      const created = tasks.enqueue(enqueue)
      return { taskIds: created.map((t) => t.id) }
    }
  )

  handle('tasks:list', () => tasks.snapshot().map(rowToSnapshot))
  handle('tasks:pause', (id: string) => tasks.pause(id))
  handle('tasks:resume', (id: string) => tasks.resume(id))
  handle('tasks:cancel', (id: string) => tasks.cancel(id))
  handle('tasks:retry', (id: string) => tasks.retry(id))
  handle('tasks:remove', (id: string) => tasks.remove(id))

  // ------------------------------------------------------------ 历史/库
  handle('history:list', () => repos.listHistory())
  // 媒体库 = 已归档到本机的媒体（含落盘路径）；解析过但没下载的
  // 条目只存在于 media 表里，属于预览缓存，不进媒体库。
  handle('library:list', (author?: string) => repos.listArchivedMedia(author))
  handle('history:clear', () => repos.clearHistory())

  // ------------------------------------------------------- 图片本地缓存
  // IG 的 CDN 链接带签名会过期；图片字节落本地后，UI 永远从磁盘读取，
  // 不会再出现"放着不动一段时间后头像/缩略图全变占位符"。
  handle('image:cache', async (urls: string[]) => {
    const { cacheImage, cachedPath, localUrlFor } = await import('./services/image-cache')
    const out: Record<string, string> = {}
    for (const url of urls.slice(0, 200)) {
      if (!url || typeof url !== 'string') continue
      // 命中缓存不重复下载
      if (cachedPath(url)) {
        out[url] = localUrlFor(url)
        continue
      }
      try {
        out[url] = await cacheImage(url)
      } catch {
        /* 单张失败：调用方回退到原始 URL */
      }
    }
    return out
  })
  handle('image:cacheStats', async () => {
    const { cacheStats } = await import('./services/image-cache')
    return cacheStats()
  })
  handle('image:clearCache', async () => {
    const { clearImageCache } = await import('./services/image-cache')
    return clearImageCache()
  })

  handle('file:open', async (path: string) => {
    if (isKnownDownloadPath(path)) {
      const result = await shell.openPath(path)
      if (result) throw new Error(result)
    }
  })

  // 打开下载目录（不存在则创建，便于用户在资源管理器中查看归档结构）
  handle('file:openDownloadDir', async () => {
    const dir = settings.get().downloadDir
    if (!dir) return null
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const result = await shell.openPath(dir)
    if (result) throw new Error(result)
    return dir
  })

  // ------------------------------------------------------------ 设置
  handle('settings:get', () => settings.get())
  handle('settings:set', (patch: Partial<AppSettings>) => {
    const next = settings.set(patch)
    if (patch.concurrency != null) tasks.concurrency = next.concurrency
    return next
  })
  handle('settings:chooseDir', async () => {
    const w = win()
    if (!w) return null
    const r = await dialog.showOpenDialog(w, {
      properties: ['openDirectory', 'createDirectory'],
      title: uiLocale() === 'zh-CN' ? '选择下载目录' : 'Choose download directory'
    })
    if (r.canceled || r.filePaths.length === 0) return null
    return settings.set({ downloadDir: r.filePaths[0] }).downloadDir
  })
  handle('settings:session:set', (value: string | null) => {
    settings.setSession(value)
    return worker.setSession(value)
  })
  handle('settings:session:has', () => settings.hasSession())
  handle('clipboard:readText', () => clipboard.readText())
  handle('file:reveal', (path: string) => {
    if (isKnownDownloadPath(path)) shell.showItemInFolder(path)
  })
  handle('shell:openExternal', async (url: string) => {
    // 只放行 http(s)：openExternal 会把任意协议交给系统默认处理器，
    // file:// 可直接启动可执行文件，自定义协议同样可被注册表接管
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url)
  })

  // 解析服务手动复活（崩溃重启预算耗尽后的恢复入口）
  handle('worker:revive', async () => {
    await worker.revive()
    return worker.ready
  })

  // Python 运行环境状态（设置 → 关于 与解析失败指引使用：
  // 区分"没装 Python"与"版本过旧"，避免一律显示解析失败）
  handle('worker:python', () => worker.pythonStatus())

  // ------------------------------------------------- 原生窗口 / 主题同步
  // Windows 的窗口控制按钮（最小化/最大化/关闭）区由原生绘制，需按当前主题
  // 更新 titleBarOverlay 颜色与窗口底色。
  //
  // 传入的是原始 ThemeMode（'system' 也原样传）：themeSource 必须同步为同一
  // 模式，否则会出现两类不同步 ——
  //  (a) 只改 setTitleBarOverlay 不改 themeSource：按钮区保持旧色（浅色主题下
  //      渲染层已黑、控制区仍白，用户实测复现）；
  //  (b) 把 'system' 钉死为解析后的 light/dark：渲染进程的 prefers-color-scheme
  //      随之被冻结，系统主题切换后应用不再跟随。
  const applyNativeTheme = (): void => {
    const w = win()
    if (!w || w.isDestroyed()) return
    // 以 themeSource 生效后的实际值取色：'system' 时解析为当前系统偏好
    const dark = nativeTheme.shouldUseDarkColors
    const { bg, symbol } = themeColorsFor(dark)
    w.setBackgroundColor(bg)
    if (process.platform === 'win32') {
      try {
        w.setTitleBarOverlay({ color: bg, symbolColor: symbol, height: 40 })
      } catch (e) {
        console.error('[theme] setTitleBarOverlay failed:', (e as Error).message)
      }
    }
    // 渲染进程必须收到权威值：themeSource 切换会更新渲染层的
    // prefers-color-scheme，但 Electron 不派发对应的 change 事件（实测
    // matchMedia 的 change 回调为空），且切换瞬间渲染层读到的还是旧值 ——
    // 表现为"深色 → 跟随系统"后界面卡在深色。广播兜底，重读即修正。
    w.webContents.send('theme:native', dark)
  }
  handle('window:setNativeTheme', (mode: 'light' | 'dark' | 'system') => {
    const next = mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system'
    nativeTheme.themeSource = next
    applyNativeTheme()
  })
  // 'system' 模式下系统主题变化：原生控件（含 Windows 窗口控制按钮）自行刷新。
  // 渲染层的 prefers-color-scheme 由 Chromium 同步更新，useApplyTheme 会跟随。
  nativeTheme.on('updated', applyNativeTheme)

  // 应用版本（设置 → 关于 展示）。
  // 不能只用 app.getVersion()：未打包运行（electron.exe out/main/index.js）时
  // 它回退到 Electron 自身版本（实测显示 v44.7.0 而非 v0.2.0）。项目
  // package.json 在开发态位于 APP_ROOT，打包后在 asar 根（fs 对 asar 透明），
  // 两种情形都能读到真实版本。
  handle('app:version', () => {
    try {
      const root = process.env.APP_ROOT ?? __dirname
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: string }
      if (pkg.version) return String(pkg.version)
    } catch {
      /* 回退到 Electron 报告的版本 */
    }
    return app.getVersion()
  })

  // ------------------------------------------------- Instagram 登录窗口
  // 清除分区后重新登录（用于会话失效/残留时从干净状态开始）
  handle('ig:resetAndLogin', async () => {
    await clearInstagramLoginSession()
    const result = await openInstagramLogin(win(), uiLocale())
    if (result.ok && result.cookie) {
      settings.setSession(result.cookie)
      await worker.setSession(result.cookie)
      return { ok: true, hasSession: true, username: result.username ?? null }
    }
    if (result.cancelled) return { ok: false, cancelled: true }
    return { ok: false, reason: result.reason ?? 'incomplete' }
  })
  handle('ig:login', async () => {
    const result = await openInstagramLogin(win(), uiLocale())
    if (result.ok && result.cookie) {
      // 加密持久化 + 立即同步给 Python Worker
      settings.setSession(result.cookie)
      await worker.setSession(result.cookie)
      // 账号资料：安全挑战页上没有 profile 链接，此时用 ds_user_id 反查。
      // 注意不要把已有的有效用户名覆盖成空值（挑战页/加载失败时会拿不到）。
      let username = result.username ?? ''
      let avatar = result.avatar ?? ''
      if (!username) username = await resolveUsernameFromCookie().catch(() => '')
      const prev = settings.getProfile()
      if (!username && prev?.username) username = prev.username
      if (!avatar && prev?.avatar) avatar = prev.avatar
      // 头像立刻缓存到本地：IG 头像链接同样带签名会过期，
      // 否则用户放着不动一段时间回来，顶栏头像就变成占位符。
      if (avatar) {
        const { cacheImage } = await import('./services/image-cache')
        avatar = await cacheImage(avatar).catch(() => avatar)
      }
      settings.setProfile({ username, avatar })
      return {
        ok: true,
        hasSession: true,
        username: username || null,
        avatar: avatar || null
      }
    }
    if (result.cancelled) return { ok: false, cancelled: true }
    return { ok: false, reason: result.reason ?? 'incomplete' }
  })
  handle('ig:logout', async () => {
    await clearInstagramLoginSession()
    settings.setSession(null)
    settings.setProfile(null)
    await worker.setSession(null)
  })
  handle('ig:loginStatus', async () => {
    const persisted = settings.hasSession()
    let profile = settings.getProfile()
    let partition = await hasInstagramLoginSession().catch(() => false)

    // 恢复 1：session.bin 有会话但分区丢了（Chromium 异步刷盘 + 进程被强杀），
    // 把会话注回分区——这是最常见的情况，必须优先，否则会误判为未登录。
    if (persisted && !partition) {
      const cookie = settings.getSession()
      if (cookie) {
        const restored = await restoreSessionToPartition(cookie).catch(() => false)
        if (restored) {
          partition = true
          await worker.setSession(cookie).catch(() => {})
        }
      }
    }

    // 恢复 2：分区已登录但主进程状态缺失或不完整（登录成功判定漏触发 /
    // 应用中途退出），主动用页面探针验证分区会话并刷新本地状态。
    if (partition && (!persisted || !profile || !profile.username)) {
      const recovered = await recoverPartitionSession().catch(() => null)
      if (recovered) {
        settings.setSession(recovered.cookie)
        await worker.setSession(recovered.cookie)
        // 保留已有头像，并把新头像缓存到本地（IG 链接会过期）
        let avatar = recovered.avatar ?? ''
        if (avatar) {
          const { cacheImage } = await import('./services/image-cache')
          avatar = await cacheImage(avatar).catch(() => avatar)
        }
        if (!avatar && profile?.avatar) avatar = profile.avatar
        settings.setProfile({
          username: recovered.username ?? profile?.username ?? '',
          avatar
        })
        return {
          persisted: true,
          partition: true,
          profile: settings.getProfile(),
          recovered: true
        }
      }
    }
    // 头像链接可能已过期：若本地已有缓存则用本地地址（顶栏/面板不再变占位符）
    if (profile?.avatar && !profile.avatar.startsWith('instadown-img://')) {
      const { cachedPath, localUrlFor } = await import('./services/image-cache')
      if (cachedPath(profile.avatar)) {
        profile = { ...profile, avatar: localUrlFor(profile.avatar) }
        settings.setProfile(profile)
      }
    }
    return { persisted: settings.hasSession(), partition, profile }
  })
}
