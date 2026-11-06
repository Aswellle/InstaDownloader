import { app, nativeImage, net, protocol } from 'electron'
import { createHash } from 'node:crypto'
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'

/**
 * 图片本地缓存（docs/10、docs/11：本地优先）。
 *
 * 为什么必须缓存：Instagram 的 CDN 链接带签名与过期时间（`oe=` 参数），
 * 几小时后必然失效。头像与缩略图若只引用远端 URL，用户放着不动一段时间
 * 回来就会看到整片占位符（"图片不显示/未加载完整"）。把图片字节落到本地，
 * 之后永远从磁盘读取，既解决过期问题，也省去重复下载。
 *
 * 存储：{userData}/image-cache/{sha1(url)}.{ext}，仅本机，不上传任何数据。
 */

const SCHEME = 'instadown-img'

/** 本地文件缩略图协议：instadown-file://<abs path>
 *  仅允许常见图片/视频扩展名，且要求文件真实存在，防止任意文件读取。 */
export const FILE_SCHEME = 'instadown-file'

const THUMBABLE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|mp4|mov|m4v|webm)$/i

/** 允许的图片扩展名（按 URL 推断，兜底 jpg） */
function extFromUrl(url: string): string {
  const m = /\.(jpe?g|png|webp|gif|avif|heic)(?:\?|$)/i.exec(url)
  if (!m) return 'jpg'
  const e = m[1].toLowerCase()
  return e === 'jpeg' ? 'jpg' : e
}

function cacheDir(): string {
  const dir = join(app.getPath('userData'), 'image-cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function hashOf(url: string): string {
  return createHash('sha1').update(url).digest('hex')
}

/** 已缓存文件是否存在（不触发下载） */
export function cachedPath(url: string): string | null {
  const p = join(cacheDir(), `${hashOf(url)}.${extFromUrl(url)}`)
  return existsSync(p) ? p : null
}

/** 把 URL 转成本地协议地址（仅编码，不校验文件是否存在） */
export function localUrlFor(url: string): string {
  return `${SCHEME}://img/${hashOf(url)}.${extFromUrl(url)}`
}

/** 注册协议：渲染进程用 instadown-img:// 读取本地缓存文件。
 *  必须在 app ready 之前调用 registerSchemesAsPrivileged。 */
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    },
    {
      scheme: FILE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

function mimeFromExt(ext: string): string {
  switch (ext) {
    case 'png': return 'image/png'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    case 'avif': return 'image/avif'
    case 'bmp': return 'image/bmp'
    case 'mp4': case 'm4v': return 'video/mp4'
    case 'mov': return 'video/quicktime'
    case 'webm': return 'video/webm'
    default: return 'image/jpeg'
  }
}

/** app ready 后绑定协议处理器 */
export function serveImageCache(): void {
  protocol.handle(SCHEME, async (request) => {
    const name = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')
    // 防目录穿越：只接受 sha1.ext 形式的文件名
    if (!/^[a-f0-9]{40}\.[a-z0-9]{2,5}$/i.test(name)) {
      return new Response('bad name', { status: 400 })
    }
    const file = join(cacheDir(), name)
    if (!existsSync(file)) return new Response('not found', { status: 404 })
    // 直接读字节返回：net.fetch 对 file:// 支持不稳定（实测 Failed to fetch），
    // 这里自己读盘并显式给出 content-type，行为最可控。
    try {
      const buf = readFileSync(file)
      const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg'
      return new Response(new Uint8Array(buf), {
        status: 200,
        headers: {
          'content-type': mimeFromExt(ext),
          'cache-control': 'no-cache'
        }
      })
    } catch {
      return new Response('read failed', { status: 500 })
    }
  })

  // 本地已下载文件的缩略图与"应用内查看"（下载历史用）。
  // URL 形如 instadown-file://local/<encoded abs path>[?thumb=1]；仅放行存在
  // 且扩展名可渲染的文件，避免成为任意文件读取通道。
  // 支持 Range：应用内 <video> 播放/拖动进度条依赖 206 响应，否则只能从头播。
  protocol.handle(FILE_SCHEME, async (request) => {
    try {
      const u = new URL(request.url)
      // host=local，路径为绝对路径（Windows 带盘符）
      const raw = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
      const path = u.hostname === 'local' ? raw : ''
      if (!path || !THUMBABLE_EXT.test(path)) {
        return new Response('bad path', { status: 400 })
      }
      if (!existsSync(path)) return new Response('not found', { status: 404 })

      // 缩略图变体（?thumb=1）：网格里的展示不需要整张原图 —— 一张
      // 2400×3008 的原图有 1–2 MB，一屏十几张会把加载拖到数秒甚至
      // 超时破图。用 Electron 原生解码缩放成最长边 480px 的 JPEG 并按
      // (路径 + 修改时间) 缓存；nativeImage 解不了的格式回退原图。
      if (u.searchParams.get('thumb') === '1') {
        const thumb = localThumbnail(path)
        if (thumb) {
          return new Response(new Uint8Array(thumb), {
            status: 200,
            headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-cache' }
          })
        }
        // 生成失败 → 继续走原图全量响应
      }

      const ext = (path.split('.').pop() ?? 'jpg').toLowerCase()
      const mime = mimeFromExt(ext)
      const size = statSync(path).size

      const range = request.headers.get('range')
      const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null
      if (m && (m[1] || m[2])) {
        const start = m[1] ? parseInt(m[1], 10) : Math.max(0, size - parseInt(m[2], 10))
        const end = m[1] && m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1
        if (Number.isNaN(start) || start > end || start >= size) {
          return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
        }
        // 只读请求区间：视频拖动进度条会高频发 Range，整文件读取在大文件上不可接受
        const len = end - start + 1
        const chunk = Buffer.alloc(len)
        const fd = openSync(path, 'r')
        try {
          readSync(fd, chunk, 0, len, start)
        } finally {
          closeSync(fd)
        }
        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            'content-type': mime,
            'accept-ranges': 'bytes',
            'content-range': `bytes ${start}-${end}/${size}`,
            'content-length': String(len)
          }
        })
      }

      // 200 全量响应用流式返回：本地已下载的视频可能上百 MB，
      // readFileSync 整文件进内存会同时占内存并阻塞主进程事件循环
      const stream = createReadStream(path)
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 200,
        headers: {
          'content-type': mime,
          'accept-ranges': 'bytes',
          'content-length': String(size)
        }
      })
    } catch {
      return new Response('read failed', { status: 500 })
    }
  })
}

/**
 * 本地文件的缩略图字节：nativeImage 解码后缩放（最长边 480px），JPEG 落盘。
 * 缓存键含文件修改时间 —— 文件被重新下载（内容变化）后自动失效重生成。
 * 解码失败（webp/动图等 nativeImage 不支持的格式）返回 null，调用方回退原图。
 */
function localThumbnail(path: string): Buffer | null {
  try {
    const dir = join(app.getPath('userData'), 'thumb-cache')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const key = createHash('sha1')
      .update(`${path}|${statSync(path).mtimeMs}`)
      .digest('hex')
    const dest = join(dir, `${key}.jpg`)
    if (existsSync(dest)) return readFileSync(dest)

    const img = nativeImage.createFromPath(path)
    if (img.isEmpty()) return null
    const size = img.getSize()
    const longest = Math.max(size.width, size.height)
    const scaled = longest > 480 ? img.resize({ width: Math.round((480 * size.width) / longest), height: Math.round((480 * size.height) / longest) }) : img
    const jpeg = scaled.toJPEG(82)
    if (jpeg.length === 0) return null
    writeFileSync(dest, jpeg)
    return jpeg
  } catch {
    return null
  }
}

/** 下载并缓存；返回本地协议地址。失败时抛出，调用方回退到原始 URL。
 *  网络失败带退避重试两次：IG CDN 对并发的高分辨率图片请求偶发断连，
 *  而回退路径（渲染层直接 <img> 远端 URL）会被 CDN 防盗链拒绝 ——
 *  单次失败意味着这张缩略图永久破图，重试能救回绝大多数。
 *  高延迟网络下首次尝试常在建立连接阶段就失败，退避后再试成功率显著更高。 */
export async function cacheImage(url: string): Promise<string> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * attempt))
      return await cacheImageOnce(url)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

async function cacheImageOnce(url: string): Promise<string> {
  if (!/^https?:/i.test(url)) throw new Error('unsupported url')
  const local = localUrlFor(url)
  if (cachedPath(url)) return local

  const res = await net.fetch(url, {
    headers: { Referer: 'https://www.instagram.com/' }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) throw new Error('empty body')
  const dest = join(cacheDir(), `${hashOf(url)}.${extFromUrl(url)}`)
  writeFileSync(dest, buf)
  return local
}

/** 缓存占用统计（供设置面板展示） */
export function cacheStats(): { files: number; bytes: number } {
  let files = 0
  let bytes = 0
  try {
    // 目录内只有平铺文件，无需递归
    for (const f of readdirSync(cacheDir())) {
      try {
        const s = statSync(join(cacheDir(), f))
        if (s.isFile()) {
          files++
          bytes += s.size
        }
      } catch {
        /* 单个文件失败忽略 */
      }
    }
  } catch {
    /* 目录不可读 */
  }
  return { files, bytes }
}

/** 清空图片缓存，返回删除的文件数 */
export function clearImageCache(): number {
  let removed = 0
  try {
    for (const f of readdirSync(cacheDir())) {
      try {
        rmSync(join(cacheDir(), f), { force: true })
        removed++
      } catch {
        /* 忽略 */
      }
    }
  } catch {
    /* 忽略 */
  }
  return removed
}
