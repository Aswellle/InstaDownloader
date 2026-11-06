import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Download, Keyboard } from 'lucide-react'
import type { MediaItem } from '@shared/types'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Button } from '@/components/ui/primitives'
import { SmartImage } from '@/components/ui/smart-image'
import { SmartVideo } from '@/components/ui/smart-video'
import { cn, formatDate, formatDuration } from '@/lib/utils'
import { useI18n } from '@/i18n'

/**
 * 应用内媒体查看器（docs/01）：图片/视频都在应用内完成浏览与下载，
 * 全程不跳系统浏览器。
 *
 * 快捷键（页脚有可见提示，不要求用户记忆）：
 * ← → 翻页 · Enter 下载当前 · Esc 关闭
 *
 * hideDownload：查看"已下载到本机"的媒体（下载历史）时使用 ——
 * 文件已在磁盘上，下载动作无意义，隐藏按钮与 Enter 提示。
 */
export function MediaViewer({
  items,
  initialIndex,
  onClose,
  onDownload,
  hideDownload = false
}: {
  items: MediaItem[]
  initialIndex: number
  onClose: () => void
  onDownload: (item: MediaItem) => void
  hideDownload?: boolean
}) {
  const [index, setIndex] = useState(initialIndex)
  const [showKeys, setShowKeys] = useState(false)
  const { t } = useI18n()

  // 索引跟随当前内容集：items 变化（重新打开另一组内容/内容被过滤）或
  // initialIndex 变化时回到入口位置，并把越界索引拉回有效范围 ——
  // 此前在 A 内容翻到第 3 张后关闭、再打开只有 2 张的 B 内容时，
  // 残留索引越界导致查看器"切换错误"甚至直接消失。
  useEffect(() => {
    if (items.length === 0) return
    setIndex(Math.min(Math.max(0, initialIndex), items.length - 1))
  }, [items, initialIndex])

  const item = items[index] ?? null
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const goNext = useCallback(() => setIndex((i) => Math.min(items.length - 1, i + 1)), [items.length])

  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => {
      // 视频播放器聚焦时不劫持方向键（用户可能在拖进度条）
      if ((e.target as HTMLElement)?.tagName === 'VIDEO') return
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'Enter' && !hideDownload) {
        e.preventDefault()
        onDownload(item)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, goPrev, goNext, onDownload, hideDownload])

  return (
    <Dialog open={!!item} onClose={onClose} wide bodyScroll={false}>
      {item && (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col"
        >
          {/* 舞台：图片周围的黑底即"遮罩"的一部分 —— 点击图片外的黑底
              同样关闭（与 Dialog 遮罩行为一致），不必非去右上角找叉。
              高度钳制保证 pager + 页脚在 85vh 模态内完整可见，不出滚动条。 */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center bg-black/80 p-2"
            style={{ maxHeight: 'calc(85vh - 96px)' }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) onClose()
            }}
          >
            {item.type === 'video' ? (
              <SmartVideo
                src={item.url}
                poster={item.thumb_url}
                className="max-h-full max-w-full rounded-lg"
              />
            ) : (
              <SmartImage
                src={item.url}
                className="max-h-full max-w-full rounded-lg object-contain"
                fallbackClassName="h-40 w-40 rounded-lg"
                loading="eager"
              />
            )}
            {/* 翻页热区：整条侧边（高 = 舞台高、宽 72px）都可点，命中面积
                远大于图标本身；视觉上只有一个小圆钮，不增加存在感。 */}
            {items.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  disabled={index === 0}
                  title={t("viewer.prevKey")}
                  aria-label={t("viewer.prev")}
                  className={cn(
                    'absolute inset-y-0 left-0 flex w-[72px] items-center justify-start pl-2 outline-none',
                    index === 0 ? 'cursor-default' : 'cursor-pointer'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors',
                      index === 0
                        ? 'bg-white/5 text-white/20'
                        : 'bg-black/45 hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white/70'
                    )}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </span>
                </button>
                <button
                  onClick={goNext}
                  disabled={index === items.length - 1}
                  title={t("viewer.nextKey")}
                  aria-label={t("viewer.next")}
                  className={cn(
                    'absolute inset-y-0 right-0 flex w-[72px] items-center justify-end pr-2 outline-none',
                    index === items.length - 1 ? 'cursor-default' : 'cursor-pointer'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors',
                      index === items.length - 1
                        ? 'bg-white/5 text-white/20'
                        : 'bg-black/45 hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white/70'
                    )}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </span>
                </button>
              </>
            )}
          </div>

          {/* 计数条：图片正下方居中的紧凑胶囊 —— 位置紧贴内容（翻页时视线
              不用跳到页脚），样式与查看器的深色舞台一致 */}
          {items.length > 1 && (
            <div className="flex items-center justify-center gap-3 bg-black/80 py-1.5">
              <button
                onClick={goPrev}
                disabled={index === 0}
                aria-label={t("viewer.prev")}
                className="rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-default disabled:text-white/20 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-12 text-center text-xs tabular-nums text-white/90">
                {index + 1} / {items.length}
              </span>
              <button
                onClick={goNext}
                disabled={index === items.length - 1}
                aria-label={t("viewer.next")}
                className="rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-default disabled:text-white/20 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* 页脚：左侧元信息（类型/尺寸/时长/日期/快捷键），右侧主操作。
              单行布局固定，元素多时元信息侧内部横向滚动而非换行挤压按钮。 */}
          <div className="flex items-center justify-between gap-3 border-t border-app px-5 py-3">
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto text-xs text-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Badge tone="neutral" className="shrink-0">{item.type === 'video' ? t('common.video') : t('common.image')}</Badge>
              {item.width && item.height && (
                <span className="shrink-0 tabular-nums">{item.width}×{item.height}</span>
              )}
              {item.duration ? <span className="shrink-0">{formatDuration(item.duration)}</span> : null}
              {item.taken_at ? <span className="shrink-0">{formatDate(item.taken_at)}</span> : null}
              {/* 快捷键提示：隐藏操作的可见化（点击展开完整说明） */}
              <button
                type="button"
                className="group/keys flex shrink-0 cursor-pointer items-center gap-1 text-subtle transition-colors hover:text-app"
                title={hideDownload ? t("viewer.keysHintNoDownload") : t("viewer.keysHint")}
                onClick={() => setShowKeys((v) => !v)}
              >
                <Keyboard className="h-3.5 w-3.5" />
              </button>
              {showKeys && (
                <span className="shrink-0 text-[11px] text-subtle">
                  {hideDownload ? t("viewer.keysHintNoDownload") : t("viewer.keysHint")}
                </span>
              )}
            </div>
            {!hideDownload && (
              <Button variant="primary" size="sm" className="shrink-0" onClick={() => onDownload(item)}>
                <Download className="h-4 w-4" /> {t("viewer.downloadThis")}
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </Dialog>
  )
}
