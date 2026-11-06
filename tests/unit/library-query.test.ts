import { describe, expect, it } from 'vitest'
import { Repos } from '../../src/main/db/repos'
import { openDatabase, runMigrations } from '../../src/main/db/database'
import type { MediaRow } from '../../src/shared/types'

/**
 * 媒体库查询语义：只列**已归档到本机**的媒体。
 *
 * 曾经 library:list 走的是 listMedia()，即"所有解析过的媒体"——
 * 用户在主页滑一遍就会把整个 feed 写进 media 表，媒体库里随即出现
 * 一堆从未下载的条目，且没有落盘路径（点开只能依赖会过期的 CDN 链接）。
 */

function media(over: Partial<MediaRow> & { id: string }): MediaRow {
  return {
    platform: 'instagram',
    shortcode: 'ABC',
    author: 'example_author',
    url: 'https://cdn.example/a.jpg',
    thumb_url: null,
    type: 'image',
    width: 1080,
    height: 1080,
    duration: null,
    caption: null,
    taken_at: 1_700_000_000,
    created_at: 1_700_000_000_000,
    ...over
  }
}

function freshRepos(): Repos {
  return new Repos(openDatabase(':memory:'))
}

describe('媒体库只包含已归档媒体', () => {
  it('解析过但未下载的媒体不出现在媒体库', () => {
    const repos = freshRepos()
    repos.upsertMedia(media({ id: 'parsed-only' }))

    expect(repos.listMedia()).toHaveLength(1)
    expect(repos.listArchivedMedia()).toEqual([])
  })

  it('已归档媒体带出落盘路径与文件大小', () => {
    const repos = freshRepos()
    repos.upsertMedia(media({ id: 'archived' }))
    repos.insertHistory({
      task_id: 't1',
      media_id: 'archived',
      author: 'example_author',
      path: 'D:/downloads/example_author/2026-10-12/images/a.jpg',
      size: 2048,
      created_at: 1_700_000_000_000
    })

    const rows = repos.listArchivedMedia()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('archived')
    expect(rows[0].path).toBe('D:/downloads/example_author/2026-10-12/images/a.jpg')
    expect(rows[0].file_size).toBe(2048)
  })

  it('同一媒体多次下载时取最新一次路径', () => {
    const repos = freshRepos()
    repos.upsertMedia(media({ id: 'again' }))
    repos.insertHistory({
      task_id: 't1',
      media_id: 'again',
      author: 'example_author',
      path: 'D:/old/a.jpg',
      size: 100,
      created_at: 1_700_000_000_000
    })
    repos.insertHistory({
      task_id: 't2',
      media_id: 'again',
      author: 'example_author',
      path: 'D:/new/a-2.jpg',
      size: 100,
      created_at: 1_700_000_500_000
    })

    const rows = repos.listArchivedMedia()
    expect(rows).toHaveLength(1)
    expect(rows[0].path).toBe('D:/new/a-2.jpg')
  })

  it('按作者过滤只返回该作者的归档', () => {
    const repos = freshRepos()
    for (const [id, author] of [
      ['m1', 'alice'],
      ['m2', 'bob']
    ] as const) {
      repos.upsertMedia(media({ id, author }))
      repos.insertHistory({
        task_id: `t-${id}`,
        media_id: id,
        author,
        path: `D:/dl/${author}/${id}.jpg`,
        size: 10,
        created_at: 1_700_000_000_000
      })
    }

    expect(repos.listArchivedMedia().map((r) => r.id).sort()).toEqual(['m1', 'm2'])
    expect(repos.listArchivedMedia('alice').map((r) => r.id)).toEqual(['m1'])
  })
})

describe('媒体库按内容去重', () => {
  const url = 'https://cdn.example/reel-poster.jpg'

  function seedLegacyDupes(repos: Repos): void {
    // 旧版兜底解析为同一条媒体留下累积后缀 id 的多行
    for (const id of ['oembed-ABC-re', 'oembed-ABC-re-re', 'oembed-ABC-re-re-re']) {
      repos.upsertMedia(media({ id, url, thumb_url: url }))
      repos.insertHistory({
        task_id: `t-${id}`,
        media_id: id,
        author: 'example_author',
        path: `D:/dl/example_author/${id}.jpg`,
        size: 10,
        created_at: 1_700_000_000_000
      })
    }
  }

  it('同一远端媒体的多行只展示一行（id 最短的规范行）', () => {
    const repos = freshRepos()
    seedLegacyDupes(repos)
    const rows = repos.listArchivedMedia()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('oembed-ABC-re')
  })

  it('启动迁移直接清理掉累积后缀的重复行', () => {
    const repos = freshRepos()
    seedLegacyDupes(repos)
    // 迁移后 media 表本身只剩规范行；不同内容不受影响
    repos.upsertMedia(media({ id: 'other', url: 'https://cdn.example/other.jpg' }))
    repos.insertHistory({
      task_id: 't-other',
      media_id: 'other',
      author: 'example_author',
      path: 'D:/dl/example_author/other.jpg',
      size: 10,
      created_at: 1_700_000_000_000
    })
    const db = (repos as unknown as { db: import('../../src/main/db/database').DB }).db
    runMigrations(db)
    const left = db.prepare("SELECT id FROM media WHERE id LIKE 'oembed-ABC%'").all() as Array<{ id: string }>
    expect(left.map((r) => r.id)).toEqual(['oembed-ABC-re'])
    expect(repos.listArchivedMedia().map((r) => r.id).sort()).toEqual(['oembed-ABC-re', 'other'])
  })

  it('迁移把指向被删行的 history 重定向到保留行（媒体库不丢条目）', () => {
    const repos = freshRepos()
    // 只有将被删除的两行有归档记录：删掉它们后 history 全部悬空
    for (const id of ['oembed-ABC-re', 'oembed-ABC-re-re', 'oembed-ABC-re-re-re']) {
      repos.upsertMedia(media({ id, url, thumb_url: url }))
    }
    for (const id of ['oembed-ABC-re-re', 'oembed-ABC-re-re-re']) {
      repos.insertHistory({
        task_id: `t-${id}`,
        media_id: id,
        author: 'example_author',
        path: `D:/dl/example_author/${id}.jpg`,
        size: 10,
        created_at: 1_700_000_000_000
      })
    }
    // 模拟"上一版迁移删了 media 但没重定向"造成的悬空 history
    const db = (repos as unknown as { db: import('../../src/main/db/database').DB }).db
    db.prepare("DELETE FROM media WHERE id IN ('oembed-ABC-re-re', 'oembed-ABC-re-re-re')").run()
    expect(repos.listArchivedMedia()).toEqual([])
    runMigrations(db)
    const rows = repos.listArchivedMedia()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('oembed-ABC-re')
    const redirected = db.prepare("SELECT media_id FROM history WHERE media_id LIKE 'oembed-ABC%'").all() as Array<{ media_id: string }>
    expect(redirected.every((r) => r.media_id === 'oembed-ABC-re')).toBe(true)
  })

  it('作者相同的两条不同媒体互不合并', () => {
    const repos = freshRepos()
    for (const [id, u] of [
      ['a1', 'https://cdn.example/1.jpg'],
      ['a2', 'https://cdn.example/2.jpg']
    ] as const) {
      repos.upsertMedia(media({ id, url: u }))
      repos.insertHistory({
        task_id: `t-${id}`,
        media_id: id,
        author: 'example_author',
        path: `D:/dl/${id}.jpg`,
        size: 10,
        created_at: 1_700_000_000_000
      })
    }
    expect(repos.listArchivedMedia()).toHaveLength(2)
  })
})
