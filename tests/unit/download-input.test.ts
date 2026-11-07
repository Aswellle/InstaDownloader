import { describe, expect, it } from 'vitest'
import { sanitizeDownloadItems } from '../../src/main/services/download-input'

/**
 * download:add 通道的信任边界校验：不合法的项静默丢弃、合法项原样
 * 保留（含可选字段归一为 null）。
 */

const valid = {
  id: '3987286740156171133',
  type: 'image',
  url: 'https://scontent.example/v/t51.82787-15/a.jpg?oe=123',
  author: 'example_author',
  shortcode: 'AbCdEfG',
  indexNo: 1
}

describe('sanitizeDownloadItems', () => {
  it('合法项完整保留并归一可选字段为 null', () => {
    const [row] = sanitizeDownloadItems([valid])
    expect(row).toMatchObject({
      id: valid.id,
      type: 'image',
      url: valid.url,
      author: valid.author,
      shortcode: 'AbCdEfG',
      indexNo: 1,
      thumbUrl: null,
      takenAt: null,
      width: null,
      height: null,
      duration: null
    })
  })

  it('非数组与垃圾项返回空', () => {
    expect(sanitizeDownloadItems(null)).toEqual([])
    expect(sanitizeDownloadItems('x')).toEqual([])
    expect(sanitizeDownloadItems([null, 42, 'x', {}])).toEqual([])
  })

  it.each([
    ['缺 id', { ...valid, id: '' }],
    ['id 超长', { ...valid, id: 'a'.repeat(129) }],
    ['非法 type', { ...valid, type: 'movie' }],
    ['非 https url', { ...valid, url: 'http://scontent.example/a.jpg' }],
    ['url 超长', { ...valid, url: 'https://x.example/' + 'a'.repeat(2100) }],
    ['author 缺失', { ...valid, author: '' }],
    ['author 超长', { ...valid, author: 'a'.repeat(65) }],
    ['indexNo 为 0', { ...valid, indexNo: 0 }],
    ['indexNo 非整数', { ...valid, indexNo: 1.5 }],
    ['indexNo 越界', { ...valid, indexNo: 1000 }],
    ['duration 为负', { ...valid, duration: -1 }],
    ['width 非数字', { ...valid, width: 'wide' }]
  ])('丢弃：%s', (_name, bad) => {
    expect(sanitizeDownloadItems([bad])).toEqual([])
  })

  it('合法批中夹带非法项：只丢非法、其余保留', () => {
    const rows = sanitizeDownloadItems([valid, { ...valid, id: '' }, { ...valid, indexNo: 2 }])
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.indexNo)).toEqual([1, 2])
  })
})
