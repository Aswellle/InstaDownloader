import { contextBridge, ipcRenderer } from 'electron'

/**
 * preload 桥（docs/dev/02 §4）：最小暴露面，全部经 ipcRenderer.invoke。
 */

const api = {
  parseUrl: (url: string) => ipcRenderer.invoke('parse:url', url),
  getUserMedia: (username: string, maxId?: string) => ipcRenderer.invoke('user:media', username, maxId),
  searchUser: (username: string) => ipcRenderer.invoke('user:search', username),

  addDownload: (items: unknown[]) => ipcRenderer.invoke('download:add', items),
  getTasks: () => ipcRenderer.invoke('tasks:list'),
  pauseTask: (id: string) => ipcRenderer.invoke('tasks:pause', id),
  resumeTask: (id: string) => ipcRenderer.invoke('tasks:resume', id),
  cancelTask: (id: string) => ipcRenderer.invoke('tasks:cancel', id),
  retryTask: (id: string) => ipcRenderer.invoke('tasks:retry', id),
  removeTask: (id: string) => ipcRenderer.invoke('tasks:remove', id),

  getHistory: () => ipcRenderer.invoke('history:list'),
  getLibrary: (author?: string) => ipcRenderer.invoke('library:list', author),

  // 图片本地缓存（IG CDN 链接会过期；缓存后从磁盘读取）
  cacheImages: (urls: string[]) => ipcRenderer.invoke('image:cache', urls),
  getImageCacheStats: () => ipcRenderer.invoke('image:cacheStats'),
  clearImageCache: () => ipcRenderer.invoke('image:clearCache'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: unknown) => ipcRenderer.invoke('settings:set', patch),
  chooseDirectory: () => ipcRenderer.invoke('settings:chooseDir'),
  setSessionCookie: (value: string | null) => ipcRenderer.invoke('settings:session:set', value),
  hasSessionCookie: () => ipcRenderer.invoke('settings:session:has'),

  // Instagram 登录窗口（打开官方登录页，成功后加密保存 Cookie）
  igLogin: () => ipcRenderer.invoke('ig:login'),
  igResetAndLogin: () => ipcRenderer.invoke('ig:resetAndLogin'),
  igLogout: () => ipcRenderer.invoke('ig:logout'),
  igLoginStatus: () => ipcRenderer.invoke('ig:loginStatus'),

  // 原生窗口外观（Windows 窗口控制按钮区随主题）。
  // 传原始 ThemeMode（含 'system'）而非已解析的 light/dark：主进程据此设置
  // nativeTheme.themeSource，渲染进程的 prefers-color-scheme 才能继续跟随
  // 系统（若钉死为 light/dark，'跟随系统'模式会在首次调用后被冻结）。
  setNativeTheme: (mode: 'light' | 'dark' | 'system') =>
    ipcRenderer.invoke('window:setNativeTheme', mode),
  /** 主进程权威深色值：themeSource 切换不派发 matchMedia change 事件，需广播兜底 */
  onNativeTheme: (cb: (dark: boolean) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, dark: boolean) => cb(dark)
    ipcRenderer.on('theme:native', listener)
    return () => ipcRenderer.removeListener('theme:native', listener)
  },
  /** 应用版本号（设置 → 关于） */
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  /** 渲染层语言切换时同步到主进程（系统通知/对话框文案跟随） */
  setLocale: (locale: 'zh-CN' | 'en') => ipcRenderer.invoke('window:setLocale', locale),

  readClipboard: () => ipcRenderer.invoke('clipboard:readText'),
  revealFile: (path: string) => ipcRenderer.invoke('file:reveal', path),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  openFile: (path: string) => ipcRenderer.invoke('file:open', path),
  openDownloadDir: () => ipcRenderer.invoke('file:openDownloadDir'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  onTaskEvent: (cb: (ev: unknown) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, ev: unknown) => cb(ev)
    ipcRenderer.on('task:event', listener)
    return () => ipcRenderer.removeListener('task:event', listener)
  },
  onWorkerStatus: (cb: (status: 'ready' | 'down') => void) => {
    const listener = (_e: Electron.IpcRendererEvent, status: 'ready' | 'down') => cb(status)
    ipcRenderer.on('worker:status', listener)
    return () => ipcRenderer.removeListener('worker:status', listener)
  },
  /** 解析服务崩溃重启耗尽后手动复活（返回复活后是否就绪） */
  reviveWorker: () => ipcRenderer.invoke('worker:revive'),
  /** Python 运行环境状态（解析失败指引 / 设置 → 关于） */
  getPythonStatus: () => ipcRenderer.invoke('worker:python')
}

contextBridge.exposeInMainWorld('instadown', api)

export type InstadownApi = typeof api
