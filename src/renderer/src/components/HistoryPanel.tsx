import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  Trash2,
  FolderOpen,
  Copy,
  ExternalLink,
  History as HistoryIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { HistoryRow, MediaItem } from '@shared/types'
import { formatBytes, formatDate } from '@/lib/utils'
import { canViewInApp, fileKindOf, localFileUrl } from '@/lib/local-file'
import { FileThumb } from '@/components/ui/file-thumb'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useI18n } from '@/i18n'

interface HistoryPanelProps {
  open: boolean
  onClose: () => void
  /** 应用内查看：把（可查看条目 + 点击索引）交给 App 渲染 MediaViewer。
   *  查看器状态放在 App 是为了 Esc 分层（先关查看器、再关面板）——
   *  若放在本组件内，App 的全局 Esc 会同时关掉两者。 */
  onOpenViewer: (items: MediaItem[], index: number) => void
}

export function HistoryPanel({ open, onClose, onOpenViewer }: HistoryPanelProps) {
  const { t } = useI18n()
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await window.instadown.getHistory()
      setHistory(rows)
    } catch {
      toast.error(t('history.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (open) {
      fetchHistory()
    }
  }, [open, fetchHistory])

  /** 可查看条目（图片/视频）→ MediaViewer 条目。
   *  url 用本地文件协议：已落盘的文件不再依赖任何远端链接，
   *  离线、原链接过期都能正常查看。 */
  const viewableItems = useMemo<MediaItem[]>(
    () =>
      history
        .filter((r) => canViewInApp(r.path))
        .map((r) => ({
          id: String(r.id),
          type: fileKindOf(r.path) === 'video' ? 'video' : 'image',
          url: localFileUrl(r.path),
          thumb_url: null,
          width: null,
          height: null,
          duration: null,
          taken_at: r.created_at
        })),
    [history]
  )

  const handleOpen = useCallback(
    (row: HistoryRow) => {
      if (!canViewInApp(row.path)) {
        // 非图片/视频（未知扩展名）：应用内无法渲染，交给系统默认程序
        void window.instadown.openFile(row.path).catch(() => toast.error(t('history.openFailed')))
        return
      }
      const idx = viewableItems.findIndex((i) => i.id === String(row.id))
      onOpenViewer(viewableItems, idx >= 0 ? idx : 0)
    },
    [viewableItems, onOpenViewer, t]
  )

  const handleReveal = useCallback(async (path: string) => {
    try {
      await window.instadown.revealFile(path)
    } catch {
      toast.error(t('history.revealFailed'))
    }
  }, [t])

  const handleOpenExternal = useCallback(async (path: string) => {
    try {
      await window.instadown.openFile(path)
    } catch {
      toast.error(t('history.openFailed'))
    }
  }, [t])

  const handleCopyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      toast.success(t('history.pathCopied'))
    } catch {
      toast.error(t('history.copyFailed'))
    }
  }, [t])

  const handleClearHistory = useCallback(async () => {
    try {
      await window.instadown.clearHistory()
      setHistory([])
      setConfirmClear(false)
      toast.success(t('history.cleared'))
    } catch {
      toast.error(t('history.clearFailed'))
    }
  }, [t])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 用 absolute（相对主内容区）而非 fixed：fixed top-0 会盖住顶部
              标题栏与 Windows 原生窗口控制按钮，导致按钮样式/位置异常。 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 z-40 bg-overlay"
            onClick={onClose}
          />
          {/* 抽屉滑入用缓出曲线而非弹簧：弹簧在收尾处的回弹会让列表内容
              跟着抖动，与"平滑抽屉"的预期相悖；0.34s 的标准缓出在
              快与稳之间取平衡，遮罩淡出略慢于抽屉避免闪黑。 */}
          <motion.div
            initial={{ x: '-100%', opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0.6 }}
            transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
            className="absolute left-0 top-0 z-50 flex h-full w-80 flex-col border-r border-app bg-app"
          >
            {/* Header */}
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-app px-4">
              <HistoryIcon className="h-4 w-4 text-rose-400" />
              <span className="text-sm font-medium text-app">{t("history.title")}</span>
              <span className="text-xs text-subtle">{t("history.count", { n: history.length })}</span>
              <div className="ml-auto flex items-center gap-1">
                {history.length > 0 && (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-hover/60 hover:text-app"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("history.clear")}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-muted hover:bg-surface-hover/60 hover:text-app"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-subtle">
                  {t('common.loading')}
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-subtle">
                  <HistoryIcon className="mb-2 h-8 w-8" />
                  <span className="text-sm">{t("history.empty")}</span>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {history.map((row) => (
                    <HistoryItem
                      key={row.id}
                      row={row}
                      onOpen={handleOpen}
                      onReveal={handleReveal}
                      onOpenExternal={handleOpenExternal}
                      onCopy={handleCopyPath}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* 清空历史：破坏性操作必须确认（防误触；文件本身不受影响） */}
      <ConfirmDialog
        open={confirmClear}
        title={t("history.confirmTitle")}
        message={t("history.confirmBody", { n: history.length })}
        confirmLabel={t("history.clear")}
        onConfirm={() => void handleClearHistory()}
        onCancel={() => setConfirmClear(false)}
      />
    </AnimatePresence>
  )
}

function HistoryItem({
  row,
  onOpen,
  onReveal,
  onOpenExternal,
  onCopy
}: {
  row: HistoryRow
  onOpen: (row: HistoryRow) => void
  onReveal: (path: string) => void
  onOpenExternal: (path: string) => void
  onCopy: (path: string) => void
}) {
  const { t } = useI18n()
  const inApp = canViewInApp(row.path)
  return (
    <div
      className="group flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-surface-hover"
      onClick={() => onOpen(row)}
      title={inApp ? t("history.viewInApp") : t("history.openExternal")}
    >
      {/* 缩略图：图片直接读盘显示，视频/其他显示类型图标 —— 一眼看出每项是什么 */}
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-hover/60">
        <FileThumb path={row.path} className="h-10 w-10 rounded-md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-app">
          {row.author ?? t("common.unknownAuthor")}
        </div>
        <div className="truncate text-[11px] text-subtle" title={row.path}>
          {row.path.split(/[\\/]/).pop()}
        </div>
        <div className="flex items-center gap-2 text-xs text-subtle">
          <span>{formatDate(row.created_at)}</span>
          <span>·</span>
          <span>{formatBytes(row.size)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onReveal(row.path) }}
          className="rounded p-1 text-muted hover:bg-surface-hover hover:text-app"
          title={t("history.reveal")}
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </button>
        {/* 非图片/视频才需要外部程序入口；可内查看的条目由点击本身完成 */}
        {!inApp && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenExternal(row.path) }}
            className="rounded p-1 text-muted hover:bg-surface-hover hover:text-app"
            title={t("history.openExternal")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(row.path) }}
          className="rounded p-1 text-muted hover:bg-surface-hover hover:text-app"
          title={t("history.copyPath")}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
