import type { MediaRow } from '@shared/types'

/**
 * download:add 通道的入参校验（信任边界：渲染层 → 主进程）。
 *
 * 路径与扩展名已由 planPath/extFromUrl 消毒；这里校验字段的存在性、
 * 类型与量级，防止被攻破的渲染层塞入越界值（超长字符串、负数下标、
 * 非法枚举）进入任务与媒体表。
 */

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

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const isOptStr = (v: unknown, max: number): v is string | null | undefined =>
  v == null || (typeof v === 'string' && v.length <= max)
const isOptNum = (v: unknown, min: number, max: number): v is number | null | undefined =>
  v == null || (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max)

/** 逐项校验并归一；不合法的项静默丢弃（单条失败不拖垮整批）。 */
export function sanitizeDownloadItems(items: unknown): DownloadItemInput[] {
  if (!Array.isArray(items)) return []
  const out: DownloadItemInput[] = []
  for (const raw of items) {
    if (typeof raw !== 'object' || raw == null) continue
    const it = raw as Record<string, unknown>
    if (!isStr(it.id, 128)) continue
    if (it.type !== 'image' && it.type !== 'video') continue
    if (!isStr(it.url, 2048) || !/^https:\/\//i.test(it.url)) continue
    if (!isStr(it.author, 64)) continue
    if (!isOptStr(it.shortcode, 64) || !isOptStr(it.thumbUrl, 2048)) continue
    const indexNo = it.indexNo == null ? 1 : it.indexNo
    if (typeof indexNo !== 'number' || !Number.isInteger(indexNo) || indexNo < 1 || indexNo > 999) continue
    if (!isOptNum(it.takenAt, 0, Number.MAX_SAFE_INTEGER)) continue
    if (!isOptNum(it.width, 0, 100000) || !isOptNum(it.height, 0, 100000)) continue
    if (!isOptNum(it.duration, 0, 86400)) continue
    out.push({
      id: it.id,
      type: it.type,
      url: it.url,
      thumbUrl: (it.thumbUrl as string | null | undefined) ?? null,
      author: it.author,
      shortcode: (it.shortcode as string | null | undefined) ?? '',
      indexNo,
      takenAt: (it.takenAt as number | null | undefined) ?? null,
      width: (it.width as number | null | undefined) ?? null,
      height: (it.height as number | null | undefined) ?? null,
      duration: (it.duration as number | null | undefined) ?? null
    })
  }
  return out
}

/** 供 media 表 upsert 的行构造沿用既有语义（共享字段形态）。 */
export type { MediaRow }
