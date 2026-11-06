import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide = false,
  bodyScroll = true
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  wide?: boolean
  /** 内容区是否可滚动；媒体查看器等"自身已适配高度"的模态应关掉，
   *  否则右侧会出现一条几乎不动、令人困惑的滚动条 */
  bodyScroll?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // 模态遮罩盖暗网页内容，但 Windows 原生窗口控制按钮区不受遮罩影响 ——
  // 不同步时按钮区像一块孤岛。开合时通知主进程联动调暗/还原按钮区底色。
  useEffect(() => {
    if (!open) return
    void window.instadown.setChromeDim(true).catch(() => {})
    return () => {
      void window.instadown.setChromeDim(false).catch(() => {})
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 拦截同级的全局快捷键处理器（App 的逐级返回监听同一事件）：
        // 对话框自己消费 Esc，一次按键只关一层。stopImmediatePropagation
        // 而非依赖 App 侧的 DOM 检测 —— exit 动画未完成时 role="dialog"
        // 仍是文档残留，按 DOM 存在判断会误吞后续 Esc。
        e.stopImmediatePropagation()
        onClose()
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    const dialog = dialogRef.current
    const focusTarget = dialog?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
    focusTarget?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'dialog-title' : undefined}
            className={cn(
              'flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-app bg-surface shadow-2xl',
              wide ? 'max-w-3xl' : 'max-w-md'
            )}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-app px-5 py-3.5">
              <h2 id="dialog-title" className="text-sm font-semibold text-app">{title}</h2>
                <button
                  className="rounded-md p-1 text-subtle hover:bg-surface-hover hover:text-app"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className={cn('min-h-0 flex-1', bodyScroll ? 'overflow-y-auto' : 'overflow-hidden')}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
