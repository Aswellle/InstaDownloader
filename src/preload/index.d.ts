import type {
  AppError,
  AppSettings,
  HistoryRow,
  MediaItem,
  MediaRow,
  ProfileMediaPage,
  ProfileUser,
  PythonStatus,
  TaskSnapshot
} from '@shared/types'

/** window.instadown 类型声明（与 src/preload/index.ts 保持一致） */

export interface ParseResult {
  kind: 'collection'
  collection: { source: { kind: 'post' | 'story'; shortcode?: string; username?: string }; author: { username: string; full_name?: string; avatar?: string }; items: MediaItem[]; caption?: string }
}
export interface ParseProfileResult {
  kind: 'profile'
  user: ProfileUser
}
export interface ParseError {
  error: AppError
}

export interface DownloadItemInput {
  id: string
  type: 'image' | 'video'
  url: string
  thumbUrl?: string | null
  author: string
  shortcode: string
  indexNo: number
  takenAt?: number | null
  width?: number | null
  height?: number | null
  duration?: number | null
}

export interface TaskEventMsg {
  kind: 'progress' | 'status' | 'created' | 'removed'
  id: string
  progress?: number
  speed?: number
  downloaded?: number
  total?: number
  status?: TaskSnapshot['status']
  error?: string | null
  destPath?: string
}

declare global {
  interface Window {
    instadown: {
      parseUrl(url: string): Promise<ParseResult | ParseProfileResult | ParseError>
      searchUser(username: string): Promise<{ user: ProfileUser } | ParseError>
      getUserMedia(username: string, maxId?: string): Promise<ProfileMediaPage | ParseError>
      addDownload(items: DownloadItemInput[]): Promise<{ taskIds: string[] }>
      getTasks(): Promise<TaskSnapshot[]>
      pauseTask(id: string): Promise<void>
      resumeTask(id: string): Promise<void>
      cancelTask(id: string): Promise<void>
      retryTask(id: string): Promise<void>
      removeTask(id: string): Promise<void>
      getHistory(): Promise<HistoryRow[]>
      getLibrary(author?: string): Promise<MediaRow[]>
      /** 批量缓存图片到本地；返回 原始URL → 本地协议URL 的映射 */
      cacheImages(urls: string[]): Promise<Record<string, string>>
      getImageCacheStats(): Promise<{ files: number; bytes: number }>
      clearImageCache(): Promise<number>
      getSettings(): Promise<AppSettings>
      setSettings(patch: Partial<AppSettings>): Promise<AppSettings>
      chooseDirectory(): Promise<string | null>
      setSessionCookie(value: string | null): Promise<void>
      hasSessionCookie(): Promise<boolean>
      igLogin(): Promise<{ ok: boolean; hasSession?: boolean; username?: string | null; avatar?: string | null; cancelled?: boolean; reason?: 'timeout' | 'incomplete' }>
      igResetAndLogin(): Promise<{ ok: boolean; hasSession?: boolean; username?: string | null; avatar?: string | null; cancelled?: boolean; reason?: 'timeout' | 'incomplete' }>
      igLogout(): Promise<void>
      igLoginStatus(): Promise<{ persisted: boolean; partition: boolean; profile: { username: string; avatar: string } | null }>
      /** 原始主题模式（'system' 交由主进程解析，保持系统跟随不被冻结） */
      setNativeTheme(mode: 'light' | 'dark' | 'system'): Promise<void>
      /** 主进程权威深色值广播（themeSource 切换不触发 matchMedia change 事件） */
      onNativeTheme(cb: (dark: boolean) => void): () => void
      /** 应用版本号（设置 → 关于） */
      getAppVersion(): Promise<string>
      /** 渲染层语言切换时同步到主进程（系统通知/对话框文案跟随） */
      setLocale(locale: 'zh-CN' | 'en'): Promise<void>
      readClipboard(): Promise<string>
      revealFile(path: string): Promise<void>
      clearHistory(): Promise<void>
      openFile(path: string): Promise<void>
      openDownloadDir(): Promise<string | null>
      openExternal(url: string): Promise<void>
      onTaskEvent(cb: (ev: TaskEventMsg) => void): () => void
      onWorkerStatus(cb: (status: 'ready' | 'down') => void): () => void
      /** 解析服务崩溃重启耗尽后手动复活（返回复活后是否就绪） */
      reviveWorker(): Promise<boolean>
      /** Python 运行环境状态（解析失败指引 / 设置 → 关于） */
      getPythonStatus(): Promise<PythonStatus>
    }
  }
}

export {}
