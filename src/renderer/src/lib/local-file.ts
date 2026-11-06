/**
 * 本地已下载文件在渲染进程中的地址与类型判定。
 *
 * 主进程 `instadown-file://` 协议只放行"存在且扩展名可渲染"的文件
 * （见 src/main/services/image-cache.ts），因此这里列出的扩展名必须
 * 与主进程 THUMBABLE_EXT 保持一致，否则会 400 而非静默失败。
 */

const IMG_EXT = /\.(jpe?g|png|webp|gif|avif|bmp)$/i
/** 应用内可播放的容器（与主进程放行列表一致；avi/mkv 仅显示图标不播放） */
const VID_EXT = /\.(mp4|mov|m4v|webm)$/i

/** 路径 → 本地文件协议地址（应用内 <img>/<video> 可直接使用） */
export function localFileUrl(path: string): string {
  return `instadown-file://local/${encodeURIComponent(path)}`
}

/**
 * 路径 → 本地缩略图协议地址（主进程用 nativeImage 缩到最长边 480px 并缓存）。
 * 网格展示专用：整张原图有 1–2 MB，一屏十几张会把加载拖到数秒甚至超时破图。
 * 主进程生成失败时按原图回退（协议内部处理），渲染层无需关心。
 */
export function localThumbUrl(path: string): string {
  return `instadown-file://local/${encodeURIComponent(path)}?thumb=1`
}

export function isRenderableImage(path: string): boolean {
  return IMG_EXT.test(path)
}

export function isRenderableVideo(path: string): boolean {
  return VID_EXT.test(path)
}

/** 历史记录条目的可查看性：图片/视频可在应用内查看，其余走系统默认程序 */
export function canViewInApp(path: string): boolean {
  return IMG_EXT.test(path) || VID_EXT.test(path)
}

export function fileKindOf(path: string): 'image' | 'video' | 'other' {
  if (VID_EXT.test(path)) return 'video'
  if (IMG_EXT.test(path)) return 'image'
  return 'other'
}
