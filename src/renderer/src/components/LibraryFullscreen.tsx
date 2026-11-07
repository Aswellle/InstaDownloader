import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  CheckSquare,
  CircleHelp,
  Download,
  Film,
  Grid2X2,
  Image as ImageIcon,
  Minimize2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Square,
  X,
} from 'lucide-react'
import type { MediaRow } from '@shared/types'
import { cn, formatDate, formatDuration } from '@/lib/utils'
import { localFileUrl, localThumbUrl } from '@/lib/local-file'
import { Button, Checkbox, Input } from '@/components/ui/primitives'
import { SmartImage } from '@/components/ui/smart-image'
import { useI18n, type TFn } from '@/i18n'
import {
  loadLibraryPrefs,
  saveLibraryPrefs,
  type LibrarySort,
  type LibraryTypeFilter
} from '@/lib/library-prefs'

/**
 * 全屏媒体库（独立的视觉模块）。
 *
 * 与侧边栏（单列、适合快速瞄一眼最近下载）互补：全屏视图提供
 * 网格布局 + 类型/作者/日期检索 + 排序 + 多选批量下载，
 * 空间利用率高，能快速触达大量内容中的目标。
 * 点击媒体在**应用内**查看/播放（MediaViewer），全程不跳浏览器。
 */

type TypeFilter = LibraryTypeFilter
type SortKey = LibrarySort

const SORT_KEYS: SortKey[] = ['date-desc', 'date-asc', 'author', 'size-desc']

function sortLabel(sort: SortKey, t: TFn): string {
  switch (sort) {
    case 'date-desc': return t('libFull.sortNewest')
    case 'date-asc': return t('libFull.sortOldest')
    case 'author': return t('libFull.sortAuthor')
    case 'size-desc': return t('libFull.sortSize')
  }
}

export function LibraryFullscreen({
  open,
  onClose,
  onGoHome,
  items,
  loading,
  onOpenItem,
  onDownloadMany,
  onRefresh
}: {
  open: boolean
  onClose: () => void
  /** 返回主页面（清空解析结果回到初始页） */
  onGoHome: () => void
  items: MediaRow[]
  loading: boolean
  /** 应用内查看（大图/播放），不跳浏览器 */
  onOpenItem: (item: MediaRow) => void
  onDownloadMany: (items: MediaRow[]) => void
  onRefresh: () => void
}) {
  const { t } = useI18n()
  // 视图偏好跨会话保留：排序、类型筛选是"我习惯怎么看"，每次进来
  // 都回到默认值会让用户重复设置。
  const prefs = useRef(loadLibraryPrefs()).current
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(prefs.typeFilter)
  const [author, setAuthor] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>(prefs.sort)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // 类型筛选与排序变化时写回
  useEffect(() => {
    saveLibraryPrefs({ typeFilter, sort })
  }, [typeFilter, sort])

  // 筛选条件是否偏离默认（决定按钮是否高亮）
  const filtersActive = author !== 'all' || sort !== 'date-desc'

  useEffect(() => {
    if (open) {
      setSelected(new Set())
      setFiltersOpen(false)
      setHelpOpen(false)
    }
  }, [open])

  // 点击外部关闭筛选抽屉
  useEffect(() => {
    if (!filtersOpen) return
    const onDown = (e: MouseEvent) => {
      if (!filterRef.current?.contains(e.target as Node)) setFiltersOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [filtersOpen])

  // Esc 逐级退出：先关帮助/抽屉，再清多选，最后关面板
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (helpOpen) setHelpOpen(false)
      else if (filtersOpen) setFiltersOpen(false)
      else if (selected.size > 0) setSelected(new Set())
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, selected.size, filtersOpen, helpOpen, onClose])

  const authors = useMemo(() => {
    const counts = new Map<string, number>()
    for (const it of items) {
      const a = it.author || t('common.unknownAuthor')
      counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [items, t])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = items
    if (author !== 'all') list = list.filter((i) => (i.author || t('common.unknownAuthor')) === author)
    if (typeFilter !== 'all') list = list.filter((i) => i.type === typeFilter)
    if (q) {
      list = list.filter(
        (i) =>
          (i.author || '').toLowerCase().includes(q) ||
          (i.shortcode || '').toLowerCase().includes(q) ||
          (i.caption || '').toLowerCase().includes(q)
      )
    }
    const sorted = [...list]
    switch (sort) {
      case 'date-asc':
        sorted.sort((a, b) => a.created_at - b.created_at)
        break
      case 'author':
        sorted.sort(
          (a, b) => (a.author || '').localeCompare(b.author || '') || b.created_at - a.created_at
        )
        break
      case 'size-desc':
        sorted.sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))
        break
      default:
        sorted.sort((a, b) => b.created_at - a.created_at)
    }
    return sorted
  }, [items, search, typeFilter, author, sort, t])

  const toggleSelect = (id: string, additive: boolean) => {
    setSelected((prev) => {
      const next = additive ? new Set(prev) : new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((i) => i.id)))
  }

  const imgCount = items.filter((i) => i.type === 'image').length
  const vidCount = items.filter((i) => i.type === 'video').length

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[55] flex flex-col bg-app"
        >
          {/* ───────────── 顶栏 ─────────────
              分三段，只有中段（搜索）参与伸缩：
                · 左：返回 + 标题 + 统计 —— shrink-0，不压缩
                · 中：搜索 —— flex-1，min-w-0，窄窗口下先被压缩
                · 右：筛选/排序/操作 —— shrink-0，按钮不换行不缩形
              排序与作者筛选在窄窗口收纳进「筛选」抽屉（filtersOpen），
              避免多个控件同时挤在 56px 高度里互相挤压变形。 */}
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-app px-3">
            {/* 退出入口：全屏模块必须有清晰的"回去"路径 */}
            <button
              onClick={onGoHome}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-app px-2.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-app"
              title={t('libFull.back')}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden md:inline">{t('libFull.back')}</span>
            </button>

            <Grid2X2 className="h-5 w-5 shrink-0 text-rose-500" />
            <div className="shrink-0">
              <div className="whitespace-nowrap text-sm font-semibold text-app">
                {t('libFull.title')}
              </div>
              <div className="whitespace-nowrap text-[11px] text-subtle">
                {t('libFull.statsLine', { total: items.length, img: imgCount, vid: vidCount })}
              </div>
            </div>

            {/* 搜索：唯一可伸缩元素。min-w-0 是关键 —— 缺了它输入框
                不会收缩，会把自己和其他控件一起挤出可视区。 */}
            <div className="relative mx-auto min-w-0 flex-1 sm:max-w-sm lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('libFull.searchAll')}
                className="h-9 pl-9 pr-8"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-subtle hover:text-app"
                  title={t('libFull.clearSearch')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* 右侧操作区：shrink-0 + whitespace-nowrap，永不换行变形 */}
            <div className="flex shrink-0 items-center gap-1.5">
              {/* 类型过滤：图标 + 文字，窄窗口只留图标 */}
              <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-app p-0.5">
                {(
                  [
                    ['all', t('libFull.filterAll'), null],
                    ['image', t('libFull.filterImage'), ImageIcon],
                    ['video', t('libFull.filterVideo'), Film]
                  ] as Array<[TypeFilter, string, typeof ImageIcon | null]>
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    onClick={() => setTypeFilter(value)}
                    className={cn(
                      'flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs transition-colors',
                      typeFilter === value
                        ? 'bg-rose-500 text-white'
                        : 'text-muted hover:bg-surface-hover hover:text-app'
                    )}
                    title={label}
                  >
                    {Icon ? (
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                    ) : null}
                    <span className={Icon ? 'hidden lg:inline' : 'hidden sm:inline'}>{label}</span>
                  </button>
                ))}
              </div>

              {/* 筛选抽屉：作者 + 排序（原本两个独立下拉各占一档宽度） */}
              <div className="relative shrink-0" ref={filterRef}>
                <button
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors hover:bg-surface-hover',
                    filtersActive
                      ? 'border-rose-500/60 text-app'
                      : 'border-app text-muted hover:text-app'
                  )}
                  title={t('libFull.filtersTooltip')}
                  aria-haspopup="menu"
                  aria-expanded={filtersOpen}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{t('libFull.filters')}</span>
                  {filtersActive && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                </button>
                <AnimatePresence>
                  {filtersOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-app bg-surface p-2 shadow-2xl"
                    >
                      <div className="px-2 pb-1 text-xs font-medium text-subtle">
                        {t('libFull.authorFilterTooltip')}
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        <AuthorOption
                          label={`${t('libFull.allAuthors')}（${items.length}）`}
                          active={author === 'all'}
                          onClick={() => {
                            setAuthor('all')
                            setFiltersOpen(false)
                          }}
                        />
                        {authors.map(([name, count]) => (
                          <AuthorOption
                            key={name}
                            label={`${name}（${count}）`}
                            active={author === name}
                            onClick={() => {
                              setAuthor(name)
                              setFiltersOpen(false)
                            }}
                          />
                        ))}
                      </div>
                      <div className="my-1.5 h-px bg-app-strong" />
                      <div className="px-2 pb-1 text-xs font-medium text-subtle">
                        {t('libFull.sortTooltip')}
                      </div>
                      {SORT_KEYS.map((key) => (
                        <AuthorOption
                          key={key}
                          label={sortLabel(key, t)}
                          active={sort === key}
                          onClick={() => {
                            setSort(key)
                            setFiltersOpen(false)
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 操作：帮助 / 刷新 / 收起 */}
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setHelpOpen(true)}
                title={t('libFull.help')}
              >
                <CircleHelp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={onRefresh}
                title={t('libFull.refresh')}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={onClose}
                title={t('libFull.escHint')}
              >
                <Minimize2 className="h-4 w-4" />
                <span className="hidden md:inline">{t('libFull.collapse')}</span>
              </Button>
            </div>
          </div>

          {/* ───────────── 内容区 ───────────── */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-subtle">
                {t("common.loading")}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-subtle">
                <Grid2X2 className="mb-3 h-10 w-10" />
                <p className="text-sm">
                  {items.length === 0 ? t('libFull.empty') : t('libFull.noMatch')}
                </p>
                {items.length > 0 && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(''); setTypeFilter('all'); setAuthor('all') }}>
                    {t("libFull.clearFilters")}
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 p-4">
                {filtered.map((item) => (
                  <FullscreenCard
                    key={item.id}
                    item={item}
                    selected={selected.has(item.id)}
                    selectionMode={selected.size > 0}
                    onToggle={(additive) => toggleSelect(item.id, additive)}
                    onOpen={() => onOpenItem(item)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ───────────── 底部批量操作栏 ───────────── */}
          <AnimatePresence>
            {(selected.size > 0 || filtered.length > 0) && (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="flex h-12 shrink-0 items-center gap-3 border-t border-app px-4"
              >
                <button
                  onClick={selectAllFiltered}
                  className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-app"
                  title={t("libFull.selectAll")}
                >
                  {selected.size === filtered.length && filtered.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-rose-500" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {selected.size === filtered.length && filtered.length > 0 ? t('libFull.clearSelection') : t('libFull.selectAll')}
                </button>
                <span className="text-xs text-subtle">
                  {selected.size > 0 ? t('libFull.selectedOf', { sel: selected.size, total: filtered.length }) : t('libFull.totalItems', { n: filtered.length })}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {selected.size > 0 && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onDownloadMany(filtered.filter((i) => selected.has(i.id)))
                        setSelected(new Set())
                      }}
                    >
                      <Download className="h-4 w-4" />
                      {t("libFull.downloadSelected", { n: selected.size })}
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 操作说明（快捷键/鼠标操作可见化） */}
          <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AuthorOption({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
        active ? 'bg-rose-500/10 text-app' : 'text-muted hover:bg-surface-hover hover:text-app'
      )}
    >
      <Check className={cn('h-3.5 w-3.5', active ? 'text-rose-500' : 'opacity-0')} />
      <span className="truncate">{label}</span>
    </button>
  )
}

/** 操作说明弹层：把快捷键与鼠标操作从"隐藏知识"变成可见提示 */
function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  if (!open) return null
  const rows: Array<[string, string]> = [
    [t('libFull.helpClick'), t('libFull.helpClickDesc')],
    [t('libFull.helpMulti'), t('libFull.helpMultiDesc')],
    [t('libFull.helpSelectAll'), t('libFull.helpSelectAllDesc')],
    [t('libFull.helpArrows'), t('libFull.helpPrevNext')],
    ['Enter', t('libFull.helpEnter')],
    ['Esc', t('libFull.helpEsc')],
    [t('libFull.helpFilterSortLabel'), t('libFull.helpFilterSort')],
  ]
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-app bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-app">{t("libFull.helpTitle")}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-subtle hover:bg-surface-hover hover:text-app"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {rows.map(([key, desc]) => (
            <div key={key} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded-md border border-app bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-app">
                {key}
              </span>
              <span className="text-xs leading-relaxed text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FullscreenCard({
  item,
  selected,
  selectionMode,
  onToggle,
  onOpen
}: {
  item: MediaRow
  selected: boolean
  selectionMode: boolean
  onToggle: (additive: boolean) => void
  onOpen: () => void
}) {
  const { t } = useI18n()
  // 已归档条目优先读本地缩略图（nativeImage 缩放后的 480px 变体，几十 KB）：
  // 整张原图 1–2 MB，一屏十几张会把网格加载拖到数秒甚至超时破图。
  // 本地缩略图不可用（nativeImage 解不了的格式 / 文件被移动）时回退远端
  // thumb_url —— 那条路有图片缓存管线兜底。
  const [localFailed, setLocalFailed] = useState(false)
  useEffect(() => setLocalFailed(false), [item.path, item.id])
  // 不做逐卡入场动画：大库（数百项）下每张卡片各跑一次 framer-motion
  // 动画会让打开/筛选时明显掉帧；图片本身由 SmartImage 淡入。
  return (
    <div
      style={{ contentVisibility: 'auto' }}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl border bg-surface transition-colors',
        selected ? 'border-rose-500 ring-2 ring-rose-500/40' : 'border-app hover:border-app-strong'
      )}
      onClick={(e) => {
        // 多选态下单击即切换选中；普通态单击打开查看器
        if (selectionMode || e.ctrlKey || e.metaKey || e.shiftKey) {
          onToggle(e.ctrlKey || e.metaKey || e.shiftKey)
        } else {
          onOpen()
        }
      }}
    >
      <div className="aspect-square w-full bg-surface-hover">
        {item.path && !localFailed ? (
          <img
            src={localThumbUrl(item.path)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setLocalFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          /* 视频缩略场景显示封面帧（thumb_url 或远端 poster），点击后才进查看器播放；
              直接嵌播放器会因 CDN 链接过期一片报错，且多个自动播放互相抢资源 */
          <SmartImage
            src={item.thumb_url || item.url}
            className="h-full w-full object-cover"
            fallbackClassName="h-full w-full"
          />
        )}
      </div>

      {/* 类型角标（固定深色底 → 字面量白，勿用主题色） */}
      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-1 text-[10px] text-white backdrop-blur-sm">
        {item.type === 'video' ? (
          <>
            <Film className="h-3 w-3" />
            {item.duration ? <span>{formatDuration(item.duration)}</span> : null}
          </>
        ) : (
          <ImageIcon className="h-3 w-3" />
        )}
      </div>

      {/* 选中态勾选框 */}
      <div
        className={cn(
          'absolute right-2 top-2 transition-opacity',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <Checkbox checked={selected} />
      </div>

      {/* 底部信息（固定深色遮罩 → 字面量白） */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6">
        <div className="truncate text-[11px] font-medium text-white">
          {item.author || t('common.unknownAuthor')}
        </div>
        <div className="truncate text-[10px] text-white/70">
          {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
          {formatDate(item.created_at)}
        </div>
      </div>
    </div>
  )
}
