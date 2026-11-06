import type { DB } from './database'
import type { MediaRow } from '@shared/types'

/** 媒体行以共享契约为准（含媒体库专用的 path / file_size） */
export type { MediaRow }

export interface TaskRow {
  id: string
  media_id: string | null
  url: string
  author: string | null
  type: string | null
  shortcode: string | null
  index_no: number | null
  status: 'WAITING' | 'DOWNLOADING' | 'PAUSED' | 'SUCCESS' | 'FAILED' | 'CANCELED'
  progress: number
  speed: number
  downloaded: number
  total: number
  dest_path: string | null
  error: string | null
  created_at: number
  updated_at: number
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

export class Repos {
  constructor(private db: DB) {}

  // ------------------------------------------------------------------ media
  upsertMedia(m: MediaRow): void {
    this.db
      .prepare(
        `INSERT INTO media (id, platform, shortcode, author, url, thumb_url, type, width, height, duration, caption, taken_at, created_at)
         VALUES (?, 'instagram', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           shortcode=excluded.shortcode, author=excluded.author,
           url=excluded.url, thumb_url=excluded.thumb_url, type=excluded.type,
           width=excluded.width, height=excluded.height, duration=excluded.duration,
           caption=excluded.caption, taken_at=excluded.taken_at`
      )
      .run(
        m.id, m.shortcode ?? null, m.author ?? null, m.url, m.thumb_url ?? null,
        m.type, m.width ?? null, m.height ?? null, m.duration ?? null,
        m.caption ?? null, m.taken_at ?? null, m.created_at
      )
  }

  getMediaByAuthor(author: string, limit = 200): MediaRow[] {
    return this.db
      .prepare('SELECT * FROM media WHERE author = ? ORDER BY taken_at DESC, created_at DESC LIMIT ?')
      .all(author, limit) as unknown as MediaRow[]
  }

  /** 媒体库全量（不按作者过滤） */
  listMedia(limit = 500): MediaRow[] {
    return this.db
      .prepare('SELECT * FROM media ORDER BY created_at DESC LIMIT ?')
      .all(limit) as unknown as MediaRow[]
  }

  /**
   * 媒体库：只列**已归档到本机**的媒体，并带上落盘路径。
   *
   * 与 listMedia 的区别：listMedia 是"解析过的媒体"（预览缓存），
   * 用户在主页里滑一遍就会产生大量未下载的行。媒体库的语义是
   * "我的本地归档"，因此以 history 为准 —— 同一 media_id 可能被
   * 下载多次（重下/改名），取最新一条路径。
   *
   * 再按 (author, url) 去重：同一远端媒体只显示一次。历史上兜底
   * 解析路径曾为同一条媒体生成过多个不同 id 的行（启动迁移会清理，
   * 这里兜底保证任何来源的重复都不会在库里重复展示），同一行内取
   * id 最短者 —— 它是归档时间最早、被历史引用最多的规范行。
   */
  listArchivedMedia(author?: string, limit = 500): MediaRow[] {
    const where = author ? 'WHERE m.author = ?' : ''
    const args: Array<string | number> = author ? [author, limit] : [limit]
    return this.db
      .prepare(
        `SELECT m.*, h.path AS path, h.size AS file_size
           FROM media m
           JOIN (
             SELECT media_id, path, size, MAX(created_at) AS last_at
               FROM history
              WHERE media_id IS NOT NULL AND path <> ''
              GROUP BY media_id
           ) h ON h.media_id = m.id
          ${where}
            AND m.id = (
              SELECT MIN(m2.id) FROM media m2
               WHERE m2.url = m.url AND m2.author IS m.author
                 AND m2.id IN (
                   SELECT media_id FROM history
                    WHERE media_id IS NOT NULL AND path <> ''
                 )
            )
          ORDER BY h.last_at DESC
          LIMIT ?`
      )
      .all(...args) as unknown as MediaRow[]
  }

  // ------------------------------------------------------------------ tasks
  insertTask(t: TaskRow): void {
    this.db
      .prepare(
        `INSERT INTO tasks (id, media_id, url, author, type, shortcode, index_no, status, progress, speed, downloaded, total, dest_path, error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        t.id, t.media_id ?? null, t.url, t.author ?? null, t.type ?? null, t.shortcode ?? null,
        t.index_no ?? null, t.status, t.progress, t.speed, t.downloaded, t.total,
        t.dest_path ?? null, t.error ?? null, t.created_at, t.updated_at
      )
  }

  updateTask(id: string, patch: Partial<TaskRow>): void {
    const cols: string[] = []
    const vals: Array<string | number | null> = []
    for (const [k, v] of Object.entries(patch)) {
      cols.push(`${k} = ?`)
      vals.push(v ?? null)
    }
    if (cols.length === 0) return
    cols.push('updated_at = ?')
    vals.push(Date.now(), id)
    this.db.prepare(`UPDATE tasks SET ${cols.join(', ')} WHERE id = ?`).run(...vals)
  }

  getTask(id: string): TaskRow | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    return (row as TaskRow | undefined) ?? null
  }

  listTasks(limit = 200): TaskRow[] {
    return this.db
      .prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?')
      .all(limit) as unknown as TaskRow[]
  }

  /** 启动恢复：DOWNLOADING/WAITING -> WAITING，PAUSED 保留 */
  listResumable(): TaskRow[] {
    return this.db
      .prepare(
        `SELECT * FROM tasks WHERE status IN ('WAITING','DOWNLOADING','PAUSED') ORDER BY created_at ASC`
      )
      .all() as unknown as TaskRow[]
  }

  /** 最近的失败/取消任务：restore 时装入内存（不自动开始），
   *  让任务面板可见、可重试 —— 否则它们跨重启永久消失 */
  listRecentFailed(limit = 20): TaskRow[] {
    return this.db
      .prepare(
        `SELECT * FROM tasks WHERE status IN ('FAILED','CANCELED') ORDER BY updated_at DESC LIMIT ?`
      )
      .all(limit) as unknown as TaskRow[]
  }

  resetDownloadingToWaiting(): void {
    this.db
      .prepare(`UPDATE tasks SET status = 'WAITING', speed = 0 WHERE status = 'DOWNLOADING'`)
      .run()
  }

  deleteTask(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  // ---------------------------------------------------------------- history
  insertHistory(h: Omit<HistoryRow, 'id'>): void {
    this.db
      .prepare(
        'INSERT INTO history (task_id, media_id, author, path, size, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(h.task_id ?? null, h.media_id ?? null, h.author ?? null, h.path, h.size, h.created_at)
  }

  listHistory(limit = 500): HistoryRow[] {
    return this.db
      .prepare('SELECT * FROM history ORDER BY created_at DESC LIMIT ?')
      .all(limit) as unknown as HistoryRow[]
  }

  /** 该路径是否出现在下载历史中（file:open/reveal 的放行依据之一） */
  hasHistoryPath(path: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM history WHERE path = ? LIMIT 1').get(path)
    return row != null
  }

  clearHistory(): void {
    this.db.prepare('DELETE FROM history').run()
  }

  // --------------------------------------------------------------- settings
  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, value)
  }
}
