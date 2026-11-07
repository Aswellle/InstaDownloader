import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Film,
  Image as ImageIcon,
  Search,
  X,
  LayoutGrid,
  FolderOpen,
  Maximize2,
} from 'lucide-react'
import type { MediaRow } from '@shared/types'
import { cn, formatDate, formatDuration } from '@/lib/utils'
import { localFileUrl } from '@/lib/local-file'
import { Button, Input, Skeleton } from '@/components/ui/primitives'
import { SmartImage } from '@/components/ui/smart-image'
import { useI18n } from '@/i18n'
import { loadLibraryPrefs, saveLibraryPrefs } from '@/lib/library-prefs'

// ── Avatar color palette (deterministic by username) ─────────────────────
const AVATAR_COLORS = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-teal-500',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ── Media card ──────────────────────────────────────────────────────────
function MediaCard({
  item,
  onOpen
}: {
  item: MediaRow
  /** 应用内查看（不再跳系统浏览器） */
  onOpen: (item: MediaRow) => void
}) {
  const { t } = useI18n()
  // 已归档条目直接读本地文件：不受 CDN 签名过期影响，也不用再走图片缓存
  const thumb = item.path ? localFileUrl(item.path) : item.thumb_url || item.url
  // 卡片不做入场动画：面板滑出时几十张卡片各自跑一次 framer-motion
  // 动画是侧边栏"时常卡顿"的主因（主线程被逐帧 style 写入占满，
  // 与滑出动画抢同一帧预算）。卡片改为静态渲染，图片由 SmartImage 淡入。
  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-app bg-surface transition-colors hover:border-app-strong"
      onClick={() => onOpen(item)}
    >
      <div className="aspect-square w-full bg-surface-hover">
        <SmartImage src={thumb} className="h-full w-full object-cover" />
      </div>

      {/* Type badge */}
      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-1 text-[10px] text-white backdrop-blur-sm">
        {item.type === 'video' ? (
          <>
            <Film className="h-3 w-3" />
            {item.duration ? (
              <span>{formatDuration(item.duration)}</span>
            ) : (
              <Film className="h-3 w-3" />
            )}
          </>
        ) : (
          <ImageIcon className="h-3 w-3" />
        )}
      </div>

      {/* Bottom info：位于固定深色遮罩上，必须用字面量白色；
          主题色（text-muted/text-app）在浅色模式下会变深、贴黑底看不见 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6">
        <div className="truncate text-[11px] text-white/90">
          {item.width && item.height ? `${item.width}×${item.height}` : ''}
          {item.taken_at ? ` · ${formatDate(item.taken_at)}` : ''}
        </div>
      </div>

      {/* Hover hint */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-[background-color,opacity] group-hover:bg-black/20 group-hover:opacity-100">
        <span className="rounded-md bg-black/70 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
          {t('library.openItem')}
        </span>
      </div>
    </div>
  )
}

// ── Main panel ──────────────────────────────────────────────────────────
export function LibraryPanel({
  open,
  onClose,
  onOpenItem,
  onOpenFullscreen
}: {
  open: boolean
  onClose: () => void
  /** 应用内查看（大图/播放），不再跳浏览器 */
  onOpenItem: (item: MediaRow) => void
  /** 切换到全屏媒体库 */
  onOpenFullscreen: () => void
}) {
  const { t } = useI18n()
  const [items, setItems] = useState<MediaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // 分组/平铺是浏览习惯，跨会话保留
  const [showAll, setShowAll] = useState(() => loadLibraryPrefs().viewMode === 'flat')

  useEffect(() => {
    saveLibraryPrefs({ viewMode: showAll ? 'flat' : 'grouped' })
  }, [showAll])

  const loadLibrary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.instadown.getLibrary()
      setItems(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void loadLibrary()
    }
  }, [open, loadLibrary])

  // Group by author
  const grouped = useMemo(() => {
    const map = new Map<string, MediaRow[]>()
    for (const item of items) {
      const key = item.author || t('common.unknownAuthor')
      const arr = map.get(key)
      if (arr) arr.push(item)
      else map.set(key, [item])
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [items, t])

  // Filter by search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return grouped
    return grouped.filter(([author]) => author.toLowerCase().includes(q))
  }, [grouped, search])

  const totalCount = items.length
  const imageCount = items.filter((i) => i.type === 'image').length
  const videoCount = items.filter((i) => i.type === 'video').length

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩：点击关闭；与历史面板共用同一层级规范（遮罩 z-40 / 面板 z-50） */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-40 bg-overlay"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            className="absolute left-0 top-0 z-50 flex h-full w-96 flex-col border-r border-app bg-app will-change-transform"
          >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-app px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-400">
                <FolderOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-app">{t("library.title")}</h1>
                <p className="text-xs text-subtle">
                  {t('library.totalFiles', { n: totalCount })}
                  {imageCount > 0 && ` · ${t('library.imagesSuffix', { n: imageCount })}`}
                  {videoCount > 0 && ` · ${t('library.videosSuffix', { n: videoCount })}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* 全屏库入口：网格 + 检索 + 批量操作的完整视图 */}
              <button
                onClick={onOpenFullscreen}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-app"
                title={t("library.fullscreenTitle")}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-app"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-app/60 px-5 py-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("library.searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Button
              variant={showAll ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowAll((v) => !v)}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {showAll ? t('library.groupByAuthor') : t('library.showAll')}
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <LibrarySkeleton />
            ) : error ? (
              <ErrorState message={error} onRetry={() => void loadLibrary()} />
            ) : totalCount === 0 ? (
              <EmptyLibrary />
            ) : showAll ? (
              <FlatGrid items={items} onOpen={onOpenItem} />
            ) : (
              <GroupedView grouped={filtered} onOpen={onOpenItem} />
            )}
          </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────

function LibrarySkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3">
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="text-sm text-muted">{message}</div>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        {t('library.loginWallRetry')}
      </Button>
    </div>
  )
}

function EmptyLibrary() {
  const { t } = useI18n()
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-hover">
        <FolderOpen className="h-8 w-8 text-subtle" />
      </div>
      <h2 className="mt-4 text-base font-medium text-muted">{t("library.noMedia")}</h2>
      <p className="mt-1 text-sm text-subtle">{t("library.noMediaHint")}</p>
    </div>
  )
}

function FlatGrid({ items, onOpen }: { items: MediaRow[]; onOpen: (item: MediaRow) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3">
      {items.map((item) => (
        <MediaCard key={item.id} item={item} onOpen={onOpen} />
      ))}
    </div>
  )
}

function GroupedView({
  grouped,
  onOpen
}: {
  grouped: [string, MediaRow[]][]
  onOpen: (item: MediaRow) => void
}) {
  return (
    <div className="space-y-8">
      {grouped.map(([author, items]) => (
        <AuthorSection key={author} author={author} items={items} onOpen={onOpen} />
      ))}
    </div>
  )
}

function AuthorSection({ author, items, onOpen }: { author: string; items: MediaRow[]; onOpen: (item: MediaRow) => void }) {
  const { t } = useI18n()
  const totalWidth = items.reduce((acc, i) => acc + (i.width || 0), 0)
  const totalHeight = items.reduce((acc, i) => acc + (i.height || 0), 0)
  const avgW = items.length > 0 ? Math.round(totalWidth / items.length) : 0
  const avgH = items.length > 0 ? Math.round(totalHeight / items.length) : 0

  return (
    <section>
      {/* Author header */}
      <div className="mb-3 flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white',
            avatarColor(author),
          )}
        >
          {author.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-app">{author}</span>
            <span className="shrink-0 rounded-md bg-surface-hover px-1.5 py-0.5 text-[11px] text-muted">
              {t('library.filesCount', { n: items.length })}
            </span>
          </div>
          {avgW > 0 && avgH > 0 && (
            <div className="text-xs text-subtle">
              {t('library.avgSize', { w: avgW, h: avgH })}
            </div>
          )}
        </div>
      </div>

      {/* Media grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}
