/**
 * 主进程 / 渲染进程共享模型（docs/dev/02 §3、§4、§7）。
 *
 * ── 跨进程 wire 契约对照表（与 worker/provider.py 的注释互为镜像）──
 * 本文件是 IPC 边界（渲染层 ↔ 主进程）的唯一类型源；主进程 ↔ Python
 * worker 的 stdio JSON-RPC 契约由 worker/provider.py 的归一化函数产出，
 * 两边字段必须同步修改：
 *
 *   本文件 (TS)              worker/provider.py (Python)
 *   ─────────────────────    ─────────────────────────────
 *   MediaItem                _normalize_media / _media_node_to_item
 *     .id                      "id"（注意：IG media_id 超 Number 安全整数，
 *                              跨 worker 边界一律以字符串传输）
 *     .url/.thumb_url          "url"/"thumb_url"（仅 http(s)，见 igclient 防线）
 *     .taken_at                "taken_at"（秒级；DB 的 created_at 是毫秒）
 *   ProfileUser              _normalize_user（avatar ← profile_pic_url[_hd]）
 *   MediaCollection          resolve_post / resolve_story 返回值
 *   错误码                    WorkerError.code；ipc.ts 的 WORKER_ERROR_TO_APP
 *                            负责映射，worker 的 E_INTERNAL 在 TS 侧回落为
 *                            E_NETWORK
 * 主页媒体分页游标 nextCursor 由主进程 ProfileArchive 生成（"dom:<页>"），
 * 不再来自 worker。wire 契约破坏性变更时同步 bump worker/main.py 的
 * PROTOCOL_VERSION（主进程握手校验）。
 */

export interface MediaItem {
  id: string
  type: 'image' | 'video'
  url: string
  thumb_url?: string | null
  width?: number | null
  height?: number | null
  duration?: number | null
  taken_at?: number | null
}

export interface MediaAuthor {
  username: string
  full_name?: string
  avatar?: string
}

export interface ProfileUser extends MediaAuthor {
  user_id: string
  followers: number
  posts: number
  is_private: boolean
  is_verified: boolean
}

export interface MediaCollection {
  source: { kind: 'post' | 'reel' | 'tv' | 'story' | 'profile' | 'highlight' | 'unknown'; shortcode?: string; username?: string }
  author: MediaAuthor
  items: MediaItem[]
  caption?: string
}

export interface ProfileMediaPage {
  user: ProfileUser
  items: MediaItem[]
  nextCursor?: string | null
}

export type TaskStatus = 'WAITING' | 'DOWNLOADING' | 'PAUSED' | 'SUCCESS' | 'FAILED' | 'CANCELED'

export interface TaskSnapshot {
  id: string
  mediaId: string | null
  url: string
  author: string
  type: 'image' | 'video'
  shortcode: string
  indexNo: number
  status: TaskStatus
  progress: number
  speed: number
  downloaded: number
  total: number
  destPath: string
  error: string | null
  createdAt: number
  updatedAt: number
}

export type TaskEvent =
  | { kind: 'progress'; id: string; progress: number; speed: number; downloaded: number; total: number }
  | { kind: 'status'; id: string; status: TaskStatus; error?: string | null; destPath?: string }
  | { kind: 'created'; id: string; status: TaskStatus; destPath?: string }
  | { kind: 'removed'; id: string }

export type AppErrorCode =
  | 'E_INVALID_URL'
  | 'E_PARSE_FAILED'
  | 'E_IG_RATE_LIMIT'
  | 'E_IG_LOGIN_REQUIRED'
  | 'E_IG_PRIVATE'
  | 'E_IG_NOT_FOUND'
  | 'E_WORKER_DOWN'
  | 'E_NETWORK'
  | 'E_DISK'
  | 'E_CANCELED'

export interface AppError {
  code: AppErrorCode
  message: string
}

/** Python 运行环境状态（worker:python 通道；解析服务不可用时的指引依据） */
export interface PythonStatus {
  available: boolean
  /** bundled = 安装包内置运行时；env = INSTADOWN_PYTHON；system = 系统 Python */
  source: 'bundled' | 'env' | 'system' | null
  /** major.minor，探测失败为 null */
  version: string | null
  command: string | null
  /** unavailable 时的原因：missing = 没有可用解释器；version = 版本过旧 */
  reason: 'missing' | 'version' | null
}


export type ThemeMode = 'light' | 'dark' | 'system'

/** 界面语言。跨进程共享：main / preload / renderer 必须用同一份联合类型 */
export type Locale = 'zh-CN' | 'en'

export interface AppSettings {
  downloadDir: string
  concurrency: number
  autoClipboard: boolean
  theme: ThemeMode
  /** 经由账号的功能（Stories 等）执行前显式提醒账号风险 */
  warnAccountUse: boolean
  /** 自动把浏览过的图片缓存到本地（防 CDN 链接过期后图片失效） */
  autoCacheImages: boolean
}

export interface HistoryRow {
  id: number
  task_id: string | null
  media_id: string | null
  author: string | null
  path: string
  size: number
  created_at: number
}

export interface MediaRow {
  id: string
  platform: string
  shortcode: string | null
  author: string | null
  url: string
  thumb_url: string | null
  type: 'image' | 'video'
  width: number | null
  height: number | null
  duration: number | null
  caption: string | null
  taken_at: number | null
  created_at: number
  /** 媒体库条目专用：本机已归档文件的绝对路径（未下载的行没有该字段） */
  path?: string | null
  /** 媒体库条目专用：已归档文件大小（字节） */
  file_size?: number | null
}
