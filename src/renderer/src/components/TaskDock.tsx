import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  Clock,
  Download,
  FolderOpen,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react'
import type { TaskSnapshot } from '@shared/types'
import { useTaskStore } from '@/stores/tasks'
import { Badge, Button, Progress } from '@/components/ui/primitives'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useI18n } from '@/i18n'
import { cn, formatBytes, formatSpeed } from '@/lib/utils'
import { friendlyTaskError } from '@/lib/task-error'

const STATUS_TONE: Record<TaskSnapshot['status'], 'waiting' | 'downloading' | 'paused' | 'success' | 'failed' | 'canceled'> = {
  WAITING: 'waiting',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELED: 'canceled'
}

/** 底部常驻任务栏（docs/09：浏览器下载管理器形态） */
export function TaskDock() {
  const { t } = useI18n()
  const tasks = useTaskStore((s) => s.tasks)
  const expanded = useTaskStore((s) => s.expanded)
  const setExpanded = useTaskStore((s) => s.setExpanded)
  const remove = useTaskStore((s) => s.remove)

  const active = tasks.filter((t) => ['WAITING', 'DOWNLOADING'].includes(t.status))
  const done = tasks.filter((t) => t.status === 'SUCCESS').length
  const failed = tasks.filter((t) => ['FAILED', 'CANCELED'].includes(t.status)).length
  const totalSpeed = active.reduce((acc, t) => acc + (t.speed || 0), 0)
  const overall =
    active.length > 0
      ? active.reduce((acc, t) => acc + t.progress, 0) / Math.max(1, active.length)
      : 0

  const hasCompleted = tasks.some((t) => t.status === 'SUCCESS' || t.status === 'FAILED' || t.status === 'CANCELED')
  const completedCount = tasks.filter((t) => t.status === 'SUCCESS' || t.status === 'FAILED' || t.status === 'CANCELED').length
  const [confirmClear, setConfirmClear] = useState(false)
  /** 待确认移除的单条任务（行内 X 按钮） */
  const [pendingRemove, setPendingRemove] = useState<TaskSnapshot | null>(null)
  const clearCompleted = () => {
    const completed = tasks.filter((t) => t.status === 'SUCCESS' || t.status === 'FAILED' || t.status === 'CANCELED')
    for (const t of completed) remove(t.id)
    setConfirmClear(false)
  }

  return (
    <div className="shrink-0 border-t border-app bg-app">
      {/* 汇总条（折叠态）。行容器不能用 button：内部还有"清除已完成"按钮，
          button 嵌 button 是无效 HTML，且点击会冒泡触发折叠/展开。
          布局分区从左到右固定：图标+标题（shrink-0）→ 进度（弹性，让位）→
          速度/清除/箭头（shrink-0）。窄窗口按 md/sm 逐级隐藏次要信息，
          任何宽度下标题与按钮都完整可读、互不遮挡。 */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="flex h-11 w-full cursor-pointer select-none items-center gap-3 px-4 text-left hover:bg-surface-hover"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        <Download className="h-4 w-4 shrink-0 text-rose-400" />
        <span className="shrink-0 whitespace-nowrap text-sm text-app">
          {t('task.title')}
          <span className="ml-1.5 whitespace-nowrap text-muted">
            {active.length > 0 ? t('task.activeCount', { n: active.length }) : t('task.idle')}
            {done > 0 && ` · ${t('task.completed', { n: done })}`}
            {failed > 0 && <span className="text-rose-400"> · {t('task.failed', { n: failed })}</span>}
          </span>
        </span>
        {active.length > 0 && (
          <span className="hidden shrink-0 text-xs text-subtle sm:inline">{formatSpeed(totalSpeed)}</span>
        )}
        {(active.length > 0 || done > 0) && (
          <div className="ml-1 hidden min-w-8 flex-1 md:block">
            <Progress value={active.length > 0 ? overall : 1} className="h-1" />
          </div>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {hasCompleted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setConfirmClear(true)
              }}
              title={t("task.clearTitle")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="ml-1 hidden lg:inline">{t("task.clearCompleted")}</span>
            </Button>
          )}
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </div>

      {/* 任务列表 */}
      <AnimatePresence initial={false}>
        {expanded && tasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="max-h-60 space-y-0.5 overflow-y-auto px-2 pb-2">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} onRemove={setPendingRemove} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 清除已完成 / 移除单条：涉及删除任务记录（不可从 UI 恢复），需确认。
          确认框不允许点遮罩关闭 —— 必须在两个明确选项里做出选择。 */}
      <ConfirmDialog
        open={confirmClear}
        title={t("task.confirmClearTitle")}
        message={t("task.confirmClearBody", { n: completedCount })}
        confirmLabel={t("common.confirm")}
        onConfirm={clearCompleted}
        onCancel={() => setConfirmClear(false)}
      />
      <ConfirmDialog
        open={!!pendingRemove}
        title={t('task.confirmRemoveTitle')}
        message={
          pendingRemove
            ? t('task.confirmRemoveBody', {
                name: `${pendingRemove.author}${pendingRemove.shortcode ? ` · ${pendingRemove.shortcode}` : ''}`
              })
            : ''
        }
        confirmLabel={t('task.remove')}
        onConfirm={() => {
          if (pendingRemove) remove(pendingRemove.id)
          setPendingRemove(null)
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  )
}

function TaskRow({ task, onRemove }: { task: TaskSnapshot; onRemove: (task: TaskSnapshot) => void }) {
  // 逐字段选择：selector 返回稳定引用。返回对象字面量会让每帧产生新引用，
  // 触发无限重渲染（React error #185 → 黑屏）。
  const pause = useTaskStore((s) => s.pause)
  const resume = useTaskStore((s) => s.resume)
  const cancel = useTaskStore((s) => s.cancel)
  const retry = useTaskStore((s) => s.retry)
  const remove = useTaskStore((s) => s.remove)
  const { t } = useI18n()
  const tone = STATUS_TONE[task.status]
  const statusLabel = t(`task.status_${task.status}`)
  const indeterminate = task.status === 'DOWNLOADING' && task.total === 0
  const running = task.status === 'DOWNLOADING'

  return (
    <motion.div
      layout="position"
      className={cn(
        'group flex items-center gap-3 rounded-lg px-2 py-1.5',
        'hover:bg-surface'
      )}
    >
      <div className="w-44 min-w-0 shrink-0">
        <div className="truncate text-xs font-medium text-app">
          {task.author}
          {task.shortcode ? ` · ${task.shortcode}` : ''}
          {task.indexNo > 1 ? ` #${task.indexNo}` : ''}
        </div>
        {/* 只显示文件名（含扩展名）：完整路径塞在窄列里只会把扩展名挤到
            看不见；完整路径放悬停提示。destPath 在事件合并的快照里可能
            尚未到达（undefined），不能假设必有；路径未计划时不渲染空行。 */}
        {(task.destPath ?? '').split(/[\\/]/).pop() && (
          <div className="truncate text-xs text-subtle" title={task.destPath}>
            {(task.destPath ?? '').split(/[\\/]/).pop()}
          </div>
        )}
      </div>

      <Badge tone={tone} className="shrink-0">{statusLabel}</Badge>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* 进行中显示实时进度；完成后保留满格进度条与总量 —— 用户要求
            "达成完全下载也会保留下载进度条的效果"，一眼确认已落盘 */}
        {(running || task.status === 'SUCCESS') && (
          <Progress
            value={task.status === 'SUCCESS' ? 1 : task.progress}
            indeterminate={indeterminate}
            className={task.status === 'SUCCESS' ? '[&>div]:bg-emerald-500' : undefined}
          />
        )}
        <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted">
          {task.total > 0
            ? `${task.status === 'SUCCESS' ? 100 : Math.round(task.progress * 100)}% · ${formatBytes(task.downloaded)}/${formatBytes(task.total)}`
            : formatBytes(task.downloaded)}
          {task.speed > 0 && running && <span className="text-subtle"> · {formatSpeed(task.speed)}</span>}
        </span>
        {task.status === 'FAILED' && task.error && (
          /* 友好文案说明发生了什么与能做什么；原始错误放悬停提示供排查 */
          <span
            className="min-w-0 truncate text-xs text-rose-400/90"
            title={task.error}
          >
            {friendlyTaskError(task.error, t)}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {task.status === 'WAITING' || task.status === 'DOWNLOADING' ? (
          <Button variant="ghost" size="icon" title={t("task.pause")} onClick={() => pause(task.id)}>
            <Pause className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {task.status === 'PAUSED' && (
          <Button variant="ghost" size="icon" title={t("task.resume")} onClick={() => resume(task.id)}>
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}
        {(task.status === 'FAILED' || task.status === 'CANCELED') && (
          <Button variant="ghost" size="icon" title={t("common.retry")} onClick={() => retry(task.id)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        {task.status === 'SUCCESS' && (
          <Button
            variant="ghost"
            size="icon"
            title={t("task.openFolder")}
            onClick={() => void window.instadown.revealFile(task.destPath)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
        )}
        {['WAITING', 'DOWNLOADING', 'PAUSED'].includes(task.status) && (
          <Button variant="ghost" size="icon" title={t("task.cancel")} onClick={() => cancel(task.id)}>
            <CircleX className="h-3.5 w-3.5" />
          </Button>
        )}
        {['SUCCESS', 'FAILED', 'CANCELED'].includes(task.status) && (
          <Button
            variant="ghost"
            size="icon"
            title={t("task.remove")}
            onClick={() => onRemove(task)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* 静态状态图标（非 hover 时可见） */}
      <div className="shrink-0">
        {task.status === 'SUCCESS' && <CircleCheck className="h-4 w-4 text-emerald-500" />}
        {task.status === 'WAITING' && <Clock className="h-4 w-4 text-subtle" />}
      </div>
    </motion.div>
  )
}
