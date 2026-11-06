import { DatabaseSync } from 'node:sqlite'

/**
 * SQLite 数据层（docs/08）。Electron 内置 node:sqlite，无需原生编译。
 * 与 Electron 解耦：路径由调用方提供（主进程传 userData，测试传 :memory:）。
 */
export type DB = DatabaseSync

const SCHEMA = `
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'instagram',
  shortcode TEXT,
  author TEXT,
  url TEXT,
  thumb_url TEXT,
  type TEXT NOT NULL CHECK(type IN ('image','video')),
  width INTEGER,
  height INTEGER,
  duration REAL,
  caption TEXT,
  taken_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  media_id TEXT,
  url TEXT NOT NULL,
  author TEXT,
  type TEXT,
  shortcode TEXT,
  index_no INTEGER,
  status TEXT NOT NULL CHECK(status IN ('WAITING','DOWNLOADING','PAUSED','SUCCESS','FAILED','CANCELED')),
  progress REAL NOT NULL DEFAULT 0,
  speed REAL NOT NULL DEFAULT 0,
  downloaded INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  dest_path TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT,
  media_id TEXT,
  author TEXT,
  path TEXT,
  size INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_author ON media(author, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_media ON history(media_id, created_at DESC);
`

export function openDatabase(dbPath: string): DB {
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA synchronous = NORMAL;')
  db.exec(SCHEMA)
  runMigrations(db)
  return db
}

/**
 * 数据修正（幂等，启动时执行）：
 * 早期版本的 oembed 兜底路径为同一次解析的重复触发生成累积后缀的 id
 * （oembed-<shortcode>-re、-re-re、-re-re-re…），同一帖子在 media 表里
 * 留下多行、媒体库里表现为重复缩略图。按 (author, url) 保留 id 最短
 * （后缀最少，即最接近规范形态）的一行，其余清理。
 *
 * 删除前必须把指向被删行的 history 记录重定向到保留行——history 是
 * 媒体库展示的依据（JOIN history），悬空引用会让该媒体从库里整体
 * 消失。历史行自身有路径与文件，重定向后下载历史不受影响。
 */
export function runMigrations(db: DB): void {
  // 悬空/待删行的 id 比保留行长（累积后缀），保留行是它的前缀 ——
  // 用 instr(悬空id, 保留id) = 1 找前缀匹配，MIN 取最短规范行。
  // 1) 已悬空的 history（此前版本清理过 media 但没重定向）
  db.prepare(
    `UPDATE history
        SET media_id = (
          SELECT MIN(m2.id) FROM media m2
           WHERE m2.id LIKE 'oembed-%' AND instr(history.media_id, m2.id) = 1
        )
      WHERE media_id LIKE 'oembed-%-re%'
        AND media_id NOT IN (SELECT id FROM media)`
  ).run()
  // 2) 即将删除的重复行的 history → 重定向到保留行
  db.prepare(
    `UPDATE history
        SET media_id = (
          SELECT MIN(m2.id) FROM media m2
           WHERE m2.id LIKE 'oembed-%' AND instr(history.media_id, m2.id) = 1
        )
      WHERE media_id IN (
        SELECT id FROM media WHERE id LIKE 'oembed-%-re%'
          AND length(id) > (
            SELECT MIN(length(m2.id)) FROM media m2
             WHERE m2.url = media.url AND m2.author IS media.author
          )
      )`
  ).run()
  // 3) 删除重复 media 行
  db.prepare(
    `DELETE FROM media
      WHERE id LIKE 'oembed-%-re%'
        AND length(id) > (
          SELECT MIN(length(m2.id)) FROM media m2
           WHERE m2.url = media.url AND m2.author IS media.author
        )`
  ).run()
}
