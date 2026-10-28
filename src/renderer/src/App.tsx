import { useCallback, useEffect, useRef, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { AlertTriangle, RotateCcw, History, LayoutGrid, LogIn, Settings, ChevronDown, ArrowLeft } from 'lucide-react'
import type { MediaItem } from '@shared/types'
import { useLibraryStore, currentItems } from '@/stores/library'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useIgAccountStore } from '@/stores/ig-account'
import { useI18n, i18nT } from '@/i18n'
import { TopBar } from '@/components/TopBar'
import { MediaGrid } from '@/components/MediaGrid'
import { ProfileHeader, ProfileHeaderSkeleton } from '@/components/ProfileHeader'
import { SelectionBar } from '@/components/SelectionBar'
import { TaskDock } from '@/components/TaskDock'
import { EmptyState } from '@/components/EmptyState'
import { SettingsDialog } from '@/components/SettingsDialog'
import { IgAccountDialog } from '@/components/IgAccountDialog'
import { MediaViewer } from '@/components/MediaViewer'
import { HistoryPanel } from '@/components/HistoryPanel'
import { LibraryPanel } from '@/components/LibraryPanel'
import { LibraryFullscreen } from '@/components/LibraryFullscreen'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { MediaRow } from '@shared/types'
import { Button, Skeleton, Spinner } from '@/components/ui/primitives'
import { SmartImage } from '@/components/ui/smart-image'
import { appErrorText, errorMessage } from '@/lib/app-error'
import { localFileUrl } from '@/lib/local-file'
import { isProbablyIgUrl, classifyIgUrl } from '@shared/ig-url'
import { useApplyTheme, useIsDark } from '@/lib/theme'
import { AnimatePresence, motion } from 'framer-motion'

export default function App() {
  const view = useLibraryStore((s) => s.view)
  const selected = useLibraryStore((s) => s.selected)
  const parse = useLibraryStore((s) => s.parse)
  const loadMore = useLibraryStore((s) => s.loadMore)
  const toggle = useLibraryStore((s) => s.toggle)
  const selectAll = useLibraryStore((s) => s.selectAll)
  const clearSelection = useLibraryStore((s) => s.clearSelection)
  const goHome = useLibraryStore((s) => s.goHome)
  const accountConfirm = useLibraryStore((s) => s.accountConfirm)
  const confirmAccountUse = useLibraryStore((s) => s.confirmAccountUse)
  const cancelAccountUse = useLibraryStore((s) => s.cancelAccountUse)
  const loadTasks = useTaskStore((s) => s.load)
  const applyEvent = useTaskStore((s) => s.applyEvent)
  const loadSettings = useSettingsStore((s) => s.load)
  const setWorkerReady = useSettingsStore((s) => s.setWorkerReady)
  const setWorkerDown = useSettingsStore((s) => s.setWorkerDown)
  const workerDown = useSettingsStore((s) => s.workerDown)
  const refreshIgAccount = useIgAccountStore((s) => s.refresh)
  const setIgLoggedIn = useIgAccountStore((s) => s.setLoggedIn)

  // 应用主题（浅色 / 深色 / 跟随系统）
  useApplyTheme()
  const isDark = useIsDark()
  const themeMode = useSettingsStore((s) => s.settings?.theme ?? 'light')
  const { t } = useI18n()

  // 同步原生窗口外观（Windows 窗口控制按钮区随主题）。
  // 传原始模式：'system' 时由主进程按系统偏好解析，且系统主题变化时
  // 主进程会自行刷新原生控件颜色（渲染层由 useApplyTheme 处理）。
  useEffect(() => {
    void window.instadown.setNativeTheme(themeMode)
  }, [themeMode])


  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  /** 全屏媒体库：独立视觉模块，网格布局 + 检索 + 批量下载 */
  const [libraryFull, setLibraryFull] = useState(false)
  /** 全屏库的数据（打开时拉取） */
  const [libRows, setLibRows] = useState<MediaRow[]>([])
  const [libLoading, setLibLoading] = useState(false)
  /** 全屏库的查看器条目（MediaRow → MediaItem 适配） */
  const [libViewer, setLibViewer] = useState<{ items: MediaItem[]; index: number } | null>(null)
  /** 下载历史的查看器条目（本地已下载文件，读盘显示） */
  const [historyViewer, setHistoryViewer] = useState<{ items: MediaItem[]; index: number } | null>(null)
  const [viewerItems, setViewerItems] = useState<MediaItem[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)
  const lastAutoClipboard = useRef('')
  const [dragActive, setDragActive] = useState(false)
  const dragCounter = useRef(0)
  /** Python 运行环境缺失/过旧：workerDown 横幅升级为带指引的版本 */
  const [pythonReason, setPythonReason] = useState<'missing' | 'version' | null>(null)

  // 拖拽 URL 到窗口：自动解析
  useEffect(() => {
    const container = document.getElementById('main-container')
    if (!container) return

    const hasTextOrUrl = (e: DragEvent) => {
      const types = e.dataTransfer?.types
      return types?.includes('Text') || types?.includes('text/plain') || types?.includes('text/uri-list')
    }

    const onDragOver = (e: DragEvent) => {
      if (!hasTextOrUrl(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }

    const onDragEnter = (e: DragEvent) => {
      if (!hasTextOrUrl(e)) return
      e.preventDefault()
      dragCounter.current++
      setDragActive(true)
    }

    const onDragLeave = (e: DragEvent) => {
      if (!hasTextOrUrl(e)) return
      dragCounter.current--
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setDragActive(false)
      }
    }

    const onDrop = (e: DragEvent) => {
      if (!hasTextOrUrl(e)) return
      e.preventDefault()
      dragCounter.current = 0
      setDragActive(false)

      const text = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('text/uri-list') || ''
      if (text && isProbablyIgUrl(text)) {
        toast(t('clipboard.dropDetected'))
        void parse(text).catch((err) => toast.error(errorMessage(err)))
      }
    }

    container.addEventListener('dragover', onDragOver)
    container.addEventListener('dragenter', onDragEnter)
    container.addEventListener('dragleave', onDragLeave)
    container.addEventListener('drop', onDrop)

    return () => {
      container.removeEventListener('dragover', onDragOver)
      container.removeEventListener('dragenter', onDragEnter)
      container.removeEventListener('dragleave', onDragLeave)
      container.removeEventListener('drop', onDrop)
    }
  }, [parse, t])

  // 初始化：任务列表 / 设置 / 事件订阅
  useEffect(() => {
    void loadTasks()
    void loadSettings()
    void refreshIgAccount()
    const offTask = window.instadown.onTaskEvent(applyEvent)
    const offWorker = window.instadown.onWorkerStatus((status) => {
      setWorkerReady(status === 'ready')
      setWorkerDown(status === 'down')
      if (status === 'ready') setPythonReason(null)
      if (status === 'down') {
        toast.error(i18nT('download.workerDown'))
        // 启动失败时问一次运行环境：把"解析失败"升级成可行动的指引
        // （缺 Python / 版本过旧），而不是让用户面对一句含糊的错误
        void window.instadown
          .getPythonStatus()
          .then((py) => setPythonReason(py.available ? null : py.reason))
          .catch(() => setPythonReason(null))
      }
    })
    return () => {
      offTask()
      offWorker()
    }
    // t 不进依赖：worker 状态事件不因语言切换重订阅（文案在下次触发时取最新值）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTasks, loadSettings, applyEvent, setWorkerReady, setWorkerDown])

  const items = currentItems(view)

  // ───────────── 全屏媒体库：数据与动作 ─────────────
  const loadLibRows = useCallback(async () => {
    setLibLoading(true)
    try {
      setLibRows(await window.instadown.getLibrary())
    } catch (e) {
      toast.error(t('common.errorDetail', { prefix: t('libFull.loadFailed'), detail: errorMessage(e) }))
    } finally {
      setLibLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (libraryFull) void loadLibRows()
  }, [libraryFull, loadLibRows])

  /** 库内点击：在应用内查看（MediaViewer），不跳浏览器 */
  const openLibItem = useCallback(
    (row: MediaRow) => {
      const idx = libRows.findIndex((r) => r.id === row.id)
      // 媒体库条目都已归档到本机：优先用本地文件协议打开，
      // 离线、原链接过期都不影响；没有路径（异常数据）才退回远端 URL。
      const adapted: MediaItem[] = libRows.map((r) => ({
        id: r.id,
        type: r.type as 'image' | 'video',
        url: r.path ? localFileUrl(r.path) : r.url,
        thumb_url: r.thumb_url,
        width: r.width,
        height: r.height,
        duration: r.duration,
        taken_at: r.taken_at
      }))
      setLibViewer({ items: adapted, index: idx >= 0 ? idx : 0 })
    },
    [libRows]
  )

  /** 库内批量下载：直接按已下载文件重新入队（URL 过期时提示重新解析） */
  const downloadLibItems = useCallback(
    async (rows: MediaRow[]) => {
      if (rows.length === 0) return
      // media 行的 url 可能已过期：先尝试入队，失败交由任务系统重试/报错
      const payload = rows.map((r) => ({
        id: r.id,
        type: r.type as 'image' | 'video',
        url: r.url,
        thumbUrl: r.thumb_url,
        author: r.author || 'unknown',
        shortcode: r.shortcode || '',
        indexNo: 1,
        takenAt: r.taken_at,
        width: r.width,
        height: r.height,
        duration: r.duration
      }))
      try {
        const { taskIds } = await window.instadown.addDownload(payload)
        toast.success(t('download.queued', { n: taskIds.length }))
      } catch (e) {
        toast.error(t('common.errorDetail', { prefix: t('download.queueFailed'), detail: errorMessage(e) }))
      }
    },
    [t]
  )

  const handleParse = useCallback(
    (input: string) => {
      void parse(input).catch((e) => toast.error(errorMessage(e)))
    },
    [parse]
  )

  /** 剪贴板自动检测：按内容分类呈现不同的提示与操作。
   *  用户可能复制的是帖子链接 / 主页链接 / Stories / 裸用户名 ——
   *  一律说"检测到链接"会让用户对即将发生什么没有预期。 */
  const handleAutoClipboard = useCallback((text: string) => {
    if (text === lastAutoClipboard.current) return
    lastAutoClipboard.current = text
    const info = classifyIgUrl(text)
    const parseNow = () => void useLibraryStore.getState().parse(text)
    if (info.kind === 'post' || info.kind === 'reel' || info.kind === 'tv') {
      toast.info(t('clipboard.post'), {
        description: t('clipboard.postDesc', {
          kind: info.kind === 'reel' ? 'Reels' : t('parse.post'),
          shortcode: info.shortcode ?? ''
        }),
        action: { label: t('clipboard.postAction'), onClick: parseNow },
        duration: 6000
      })
    } else if (info.kind === 'profile') {
      toast.info(t('clipboard.profile'), {
        description: t('clipboard.profileDesc', { username: info.username ?? '' }),
        action: { label: t('clipboard.profileAction'), onClick: parseNow },
        duration: 6000
      })
    } else if (info.kind === 'story') {
      toast.info(t('clipboard.story'), {
        description: t('clipboard.storyDesc', { username: info.username ?? '' }),
        action: { label: t('clipboard.postAction'), onClick: parseNow },
        duration: 6000
      })
    } else if (info.kind === 'highlight') {
      toast.info(t('clipboard.highlight'), {
        description: t('clipboard.highlightDesc'),
        duration: 5000
      })
    } else {
      // 裸用户名或其它 IG 链接
      const isBareName = /^[A-Za-z0-9._]{1,30}$/.test(text.trim())
      toast.info(isBareName ? t('clipboard.bareName') : t('clipboard.generic'), {
        description: text.slice(0, 80),
        action: { label: t('clipboard.postAction'), onClick: parseNow },
        duration: 6000
      })
    }
  }, [t])

  // 键盘：Ctrl+A 全选 / Esc 逐级返回 / Ctrl+Enter 下载。
  // Esc 的模态让位由 Dialog 自身 stopImmediatePropagation 完成（一次按键
  // 只关一层）；这里只在模态打开时让位 Ctrl+A / Ctrl+Enter，避免作用于
  // 被遮挡的网格。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]') && e.key !== 'Escape') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && items.length > 0) {
        e.preventDefault()
        selectAll()
      } else if (e.key === 'Escape') {
        // 全屏库打开时由它自己的 Esc 处理器接管（逐级：选区→下拉→面板）
        if (libraryFull) return
        // Esc 逐级返回：查看器 → 侧边面板 → 选择 → 回到主页
        if (viewerItems.length) {
          setViewerItems([]); setViewerIndex(0)
        } else if (libViewer) {
          setLibViewer(null)
        } else if (historyViewer) {
          setHistoryViewer(null)
        } else if (historyOpen) {
          setHistoryOpen(false)
        } else if (libraryOpen) {
          setLibraryOpen(false)
        } else if (selected.size > 0) {
          clearSelection()
        } else if (view.mode !== 'empty') {
          goHome()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && selected.size > 0) {
        e.preventDefault()
        void downloadSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, selected, selectAll, clearSelection, viewerItems.length, libViewer, historyViewer, historyOpen, libraryOpen, view.mode, goHome, libraryFull])

  const downloadItems = async (targets: MediaItem[]) => {
    if (targets.length === 0) return
    let author = 'instagram'
    let shortcode = ''
    if (view.mode === 'post') {
      author = view.collection.author.username || 'instagram'
      shortcode = view.collection.source.shortcode ?? ''
    } else if (view.mode === 'profile') {
      author = view.page.user.username
    }
    const payload = targets.map((m, i) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      thumbUrl: m.thumb_url ?? null,
      author,
      shortcode,
      indexNo: shortcode ? i + 1 : 1,
      takenAt: m.taken_at ?? null,
      width: m.width ?? null,
      height: m.height ?? null,
      duration: m.duration ?? null
    }))
    try {
      const { taskIds } = await window.instadown.addDownload(payload)
      toast.success(t('download.queued', { n: taskIds.length }))
    } catch (e) {
      toast.error(t('common.errorDetail', { prefix: t('download.queueFailed'), detail: errorMessage(e) }))
    }
  }

  const downloadSelected = async () => {
    const chosen = items.filter((i) => selected.has(i.id))
    await downloadItems(chosen)
    clearSelection()
  }

  /** 打开 IG 登录窗口（供错误态与设置复用） */
  const handleIgLogin = async () => {
    try {
      const res = await window.instadown.igLogin()
      if (res.ok) {
        setIgLoggedIn({ username: res.username ?? '', avatar: res.avatar ?? '' })
        toast.success(
          res.username ? t('settings.loginOk', { name: res.username }) : t('settings.loginOkPlain'),
          { description: t('login.successDesc') }
        )
        const lastInput = view.mode === 'error' ? view.lastInput : undefined
        if (lastInput) handleParse(lastInput)
      } else if (!res.cancelled) {
        toast.error(t(res.reason === 'timeout' ? 'login.timeout' : 'login.incomplete'))
      }
    } catch (e) {
      toast.error(t('common.errorDetail', { prefix: t('settings.loginError'), detail: errorMessage(e) }))
    }
  }

  const openViewer = (item: MediaItem) => {
    const idx = items.findIndex((i) => i.id === item.id)
    setViewerItems(items)
    setViewerIndex(idx >= 0 ? idx : 0)
  }

  const onGridToggle = (id: string, e: React.MouseEvent) => {
    toggle(id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })
  }

  const onCopyLink = useCallback(async (item: MediaItem) => {
    try {
      await navigator.clipboard.writeText(item.url)
      toast.success(t('grid.linkCopied'))
    } catch {
      toast.error(t('grid.copyFailed'))
    }
  }, [t])

  const onDownloadItem = useCallback(
    (item: MediaItem) => {
      void downloadItems([item])
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view]
  )

  const onOpenInBrowser = useCallback((item: MediaItem) => {
    void window.instadown.openExternal(item.url).catch(() => {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    })
  }, [])

  const onRevealFile = useCallback((item: MediaItem) => {
    const task = useTaskStore.getState().tasks.find((t) => t.mediaId === item.id && t.status === 'SUCCESS')
    if (task?.destPath) {
      void window.instadown.revealFile(task.destPath)
    } else {
      toast.error(t('grid.noFilePath'))
    }
  }, [t])

  return (
    <div id="main-container" className="relative flex h-full flex-col">
      {/* sonner 内置 light/dark 主题，避免硬编码深色导致浅色模式下弹窗仍是深色 */}
      <Toaster
        position="top-center"
        offset={60}
        theme={isDark ? 'dark' : 'light'}
        toastOptions={{
          style: {
            background: isDark ? '#18181b' : '#ffffff',
            border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
            color: isDark ? '#e4e4e7' : '#18181b'
          }
        }}
      />
      {/* 顶栏：drag-region 作为窗口拖拽手柄。
          - 交互元素必须加 no-drag（drag-region 会吞掉 hover/click）
          - 内容宽度约束在 env(titlebar-area-width) 内，避免右侧控件
            （设置按钮）被 Windows 原生窗口控制按钮盖住 */}
      <div className="drag-region flex h-14 shrink-0 items-center gap-2 border-b border-app bg-app">
        <div className="titlebar-safe flex w-full items-center gap-2 px-4">
          <button
            className="no-drag rounded-md p-2 text-muted transition-colors hover:bg-surface-hover hover:text-app"
            title={t('topBar.history')}
            onClick={() => { setHistoryOpen(true); setLibraryOpen(false) }}
          >
            <History className="h-4 w-4" />
          </button>
          <button
            className="no-drag rounded-md p-2 text-muted transition-colors hover:bg-surface-hover hover:text-app"
            title={t('topBar.library')}
            onClick={() => {
              setHistoryOpen(false)
              setLibraryOpen(true)
            }}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          {/* 设置入口：与历史/媒体库并列，位置固定可见（原先放顶栏最右，
              会被 Windows 原生窗口控制按钮遮挡） */}
          <button
            className="no-drag rounded-md p-2 text-muted transition-colors hover:bg-surface-hover hover:text-app"
            title={t('topBar.settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <TopBar
              onParse={handleParse}
              onAutoClipboard={handleAutoClipboard}
              /* 已登录 → 账号面板；未登录 → 直接开登录窗口（不再跳设置） */
              onAccountClick={() => setAccountOpen(true)}
              onLoginClick={() => void handleIgLogin()}
            />
          </div>
        </div>
      </div>

      {/* 解析服务降级横幅：重启预算耗尽后的持久可见状态 + 手动复活入口。
          Python 环境缺失/过旧时升级为具体指引（而不是含糊的"解析失败"）。
          下载走独立的网络传输，不受影响 —— 必须说清楚，避免用户误以为全停。 */}
      {workerDown && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            {pythonReason === 'missing'
              ? t('download.pythonMissingBanner')
              : pythonReason === 'version'
                ? t('download.pythonVersionBanner')
                : t('download.workerReviveBanner')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-2 text-xs"
            onClick={() => {
              void window.instadown
                .reviveWorker()
                .then((ok) => {
                  if (ok) {
                    setPythonReason(null)
                    void window.instadown
                      .getPythonStatus()
                      .then((py) => {
                        if (py.available && py.version) toast.success(t('download.pythonReadyToast', { version: py.version }))
                      })
                      .catch(() => {})
                  } else {
                    return window.instadown
                      .getPythonStatus()
                      .then((py) => setPythonReason(py.available ? null : py.reason))
                      .catch(() => {})
                  }
                })
                .catch(() => {})
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> {t('common.retry')}
          </Button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        <HistoryPanel
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onOpenViewer={(its, idx) => setHistoryViewer({ items: its, index: idx })}
        />
        <LibraryPanel
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          onOpenItem={(row) => openLibItem(row)}
          onOpenFullscreen={() => {
            setLibraryOpen(false)
            setLibraryFull(true)
          }}
        />

        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-5 py-5">
            {view.mode === 'empty' && <EmptyState onExample={handleParse} />}

            {view.mode === 'loading' && (
              <div>
                <ProfileHeaderSkeleton />
                <GridSkeleton />
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-subtle">
                  <Spinner /> {t(view.hint)}
                </div>
              </div>
            )}

            {view.mode === 'error' && (
              <div className="mx-auto mt-24 flex max-w-md flex-col items-center text-center">
                <AlertTriangle className="h-10 w-10 text-amber-400" />
                <h2 className="mt-4 text-base font-semibold text-app">{t('parse.failed')}</h2>
                <p className="mt-2 text-sm text-muted">
                  {appErrorText(view.error.code, view.error.message)}
                </p>

                {/* 登录墙：直接提供登录入口，无需用户自己去设置里找 */}
                {view.error.code === 'E_IG_LOGIN_REQUIRED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4"
                    onClick={() => void handleIgLogin()}
                  >
                    <LogIn className="h-4 w-4" /> {t('parse.login')}
                  </Button>
                )}

                {view.canRetry && view.lastInput && (
                  <Button
                    variant={view.error.code === 'E_IG_LOGIN_REQUIRED' ? 'ghost' : 'secondary'}
                    size="sm"
                    className="mt-2"
                    onClick={() => handleParse(view.lastInput!)}
                  >
                    <RotateCcw className="h-4 w-4" /> {t('parse.retry')}
                  </Button>
                )}
              </div>
            )}

            {(view.mode === 'post' || view.mode === 'profile' || view.mode === 'error') && (
              <button
                onClick={goHome}
                className="mb-3 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-app"
                title={t('parse.backTooltip')}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t('parse.back')}
              </button>
            )}

            {view.mode === 'post' && (
              <div>
                <div className="mb-4 flex items-center gap-3">
                  {view.collection.author.avatar && (
                    <SmartImage
                      src={view.collection.author.avatar}
                      alt={view.collection.author.username}
                      className="h-10 w-10 rounded-full border border-app-strong object-cover"
                      fallbackClassName="h-10 w-10 rounded-full"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-app">
                      {view.collection.author.username}
                      {view.collection.author.full_name && (
                        <span className="ml-2 font-normal text-muted">
                          {view.collection.author.full_name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-subtle">
                      {view.collection.source.kind === 'story' ? t('parse.stories') : t('parse.post')}
                      {view.collection.source.shortcode ? ` · ${view.collection.source.shortcode}` : ''} ·{' '}
                      {t('parse.mediaCount', { n: view.collection.items.length })}
                    </div>
                  </div>
                  {view.collection.caption && (
                    <p className="ml-auto hidden max-w-sm truncate text-xs text-subtle md:block" title={view.collection.caption}>
                      {view.collection.caption}
                    </p>
                  )}
                </div>
                <MediaGrid
                  items={items}
                  selected={selected}
                  onToggle={onGridToggle}
                  onOpen={openViewer}
                  onCopyLink={onCopyLink}
                  onDownloadItem={onDownloadItem}
                  onOpenInBrowser={onOpenInBrowser}
                  onRevealFile={onRevealFile}
                />
              </div>
            )}

            {view.mode === 'profile' && (
              <div>
              <ProfileHeader user={view.page.user} loadedCount={view.page.items.length} />
              {view.page.items.length > 0 ? (
                <MediaGrid
                  items={items}
                  selected={selected}
                  onToggle={onGridToggle}
                  onOpen={openViewer}
                  onCopyLink={onCopyLink}
                  onDownloadItem={onDownloadItem}
                  onOpenInBrowser={onOpenInBrowser}
                  onRevealFile={onRevealFile}
                />
              ) : !view.page.loadingMore && !view.page.cursor ? (
                // 主页确实没有可浏览的公开帖子：给出终止文案，
                // 不能停在无限骨架屏让用户以为还在加载
                <div className="flex flex-col items-center justify-center py-16 text-subtle">
                  <LayoutGrid className="mb-2 h-8 w-8" />
                  <span className="text-sm">{t('parse.profileEmpty')}</span>
                </div>
              ) : (
                <GridSkeleton />
              )}

                {/* 分页：显式按钮，每次再取 10 条。
                    不再用滚动自动加载 —— 用户明确要求可控的分页节奏，
                    也避免长时间挂着窗口时后台不断请求被 IG 限流。 */}
                <div className="flex flex-col items-center gap-2 pb-4">
                  {view.page.loadingMore && (
                    <div className="flex items-center gap-2 text-sm text-subtle">
                      <Spinner /> {t('parse.loadingMore')}
                    </div>
                  )}
                  {!view.page.loadingMore && view.page.cursor && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void loadMore().catch((e) => toast.error(errorMessage(e)))
                        }
                      >
                        <ChevronDown className="h-4 w-4" /> {t('parse.loadMore')}
                      </Button>
                      <span className="text-[11px] text-subtle">
                        {t('parse.loadedCount', { n: view.page.items.length })}
                      </span>
                    </>
                  )}
                  {!view.page.loadingMore && !view.page.cursor && view.page.items.length > 0 && (
                    <span className="text-[11px] text-subtle">
                      {t('parse.loadedAll', { n: view.page.items.length })}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 选中操作栏（悬浮于内容之上）。
              有模态面板打开时隐藏：z-30 < 面板的 z-50，但两者会重叠成
              视觉上的"按钮打架"（曾与设置面板底部按钮糊在一起）。 */}
          {!settingsOpen && !accountOpen && !historyOpen && !libraryOpen && !libraryFull && !viewerItems.length && !libViewer && !historyViewer && (
            <SelectionBar
              count={selected.size}
              total={items.length}
              onDownload={() => void downloadSelected()}
              onSelectAll={selectAll}
              onClear={clearSelection}
            />
          )}
        </main>
      </div>

      <TaskDock />

      {/* 经由账号的功能（Stories/Highlights）解析前：账号风险确认 */}
      <ConfirmDialog
        open={!!accountConfirm}
        title={t('accountConfirm.title')}
        message={t('accountConfirm.body')}
        confirmLabel={t('accountConfirm.proceed')}
        onConfirm={() => void confirmAccountUse()}
        onCancel={cancelAccountUse}
      />

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <IgAccountDialog
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onLogin={handleIgLogin}
      />
      <MediaViewer
        items={viewerItems}
        initialIndex={viewerIndex}
        onClose={() => { setViewerItems([]); setViewerIndex(0) }}
        onDownload={(m) => {
          void downloadItems([m])
          setViewerItems([])
          setViewerIndex(0)
        }}
      />

      {/* 全屏媒体库（独立视觉模块）：网格 + 检索 + 批量下载 + 应用内查看 */}
      <LibraryFullscreen
        open={libraryFull}
        onClose={() => {
          // 收起全屏库回到侧边栏：同一份内容，只是换个密度继续浏览。
          // 要回首页用左侧「返回主页」按钮（或 Esc 后再 Esc）。
          setLibraryFull(false)
          setLibraryOpen(true)
        }}
        onGoHome={() => {
          setLibraryFull(false)
          goHome()
        }}
        items={libRows}
        loading={libLoading}
        onOpenItem={openLibItem}
        onDownloadMany={(rows) => void downloadLibItems(rows)}
        onRefresh={() => void loadLibRows()}
      />
      {/* 全屏库的应用内查看器（独立实例，避免与解析结果查看器状态互扰） */}
      <MediaViewer
        items={libViewer?.items ?? []}
        initialIndex={libViewer?.index ?? 0}
        onClose={() => setLibViewer(null)}
        onDownload={(m) => {
          const row = libRows.find((r) => r.id === m.id)
          if (row) void downloadLibItems([row])
          setLibViewer(null)
        }}
      />
      {/* 下载历史的查看器：文件已在本机，隐藏下载按钮（读盘显示，不走外部查看器） */}
      <MediaViewer
        items={historyViewer?.items ?? []}
        initialIndex={historyViewer?.index ?? 0}
        onClose={() => setHistoryViewer(null)}
        onDownload={() => setHistoryViewer(null)}
        hideDownload
      />

      <AnimatePresence>
        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-500/10"
          >
            <div className="text-lg font-medium text-blue-300">{t('drag.dropHere')}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** 主页模式的骨架屏（分页由显式按钮驱动，见 profile 分支） */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-xl" />
      ))}
    </div>
  )
}
