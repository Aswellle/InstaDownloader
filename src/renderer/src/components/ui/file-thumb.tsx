import { useEffect, useState } from 'react'
import { FileVideo, File as FileIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fileKindOf, localThumbUrl } from '@/lib/local-file'

/**
 * 本地文件缩略图：下载历史里直观展示每一项是什么。
 *
 * - 图片：走主进程缩略图变体（nativeImage 缩放后的 ~480px JPEG，几十 KB），
 *   原图 1–2 MB 一屏十几张会把抽屉加载拖到数秒甚至超时破图；协议内部
 *   生成失败时自动回退原图字节，这里只需处理最终失败 → 文件图标。
 * - 视频：读取首帧在现代浏览器里并不可靠（受编码/关键帧影响），
 *   统一显示视频文件图标，避免一片黑块。
 * - 字节就绪前显示骨架屏：抽屉打开的瞬间列表与缩略图同时出现，
 *   骨架屏让"加载中"有明确的时序感，而不是一片灰色空洞。
 */

export function FileThumb({ path, className }: { path: string; className?: string }) {
  const kind = fileKindOf(path)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setFailed(false)
    setLoaded(false)
  }, [path])

  if (kind === 'video') {
    return (
      <div
        className={cn('flex items-center justify-center bg-surface-hover text-muted', className)}
      >
        <FileVideo className="h-5 w-5" />
      </div>
    )
  }

  if (kind === 'image' && !failed) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden', className)}>
        {!loaded && <div className="absolute inset-0 animate-pulse bg-surface-hover" />}
        <img
          src={localThumbUrl(path)}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>
    )
  }

  return (
    <div
      className={cn('flex items-center justify-center bg-surface-hover text-muted', className)}
    >
      <FileIcon className="h-5 w-5" />
    </div>
  )
}
