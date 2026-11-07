import type { AppSettings } from '@shared/types'

/**
 * settings:set 通道的入参校验（信任边界：渲染层 → 主进程）。
 *
 * 白名单键 + 逐字段类型/量级校验：设置会持久化进 SQLite 并影响运行
 * 行为（并发数、目录、主题），被攻破的渲染层塞入越界值不应落库。
 */

/** 校验并归一 patch；非白名单键与类型不符的字段直接丢弃。 */
export function sanitizeSettingsPatch(patch: unknown): Partial<AppSettings> {
  if (typeof patch !== 'object' || patch == null) return {}
  const src = patch as Record<string, unknown>
  const out: Partial<AppSettings> = {}

  if (src.downloadDir !== undefined) {
    if (typeof src.downloadDir === 'string' && src.downloadDir.length > 0 && src.downloadDir.length <= 512) {
      out.downloadDir = src.downloadDir
    }
  }
  if (src.concurrency !== undefined) {
    if (typeof src.concurrency === 'number' && Number.isInteger(src.concurrency) && src.concurrency >= 1 && src.concurrency <= 6) {
      out.concurrency = src.concurrency
    }
  }
  for (const key of ['autoClipboard', 'warnAccountUse', 'autoCacheImages'] as const) {
    if (src[key] !== undefined) {
      if (typeof src[key] === 'boolean') out[key] = src[key]
    }
  }
  if (src.theme !== undefined) {
    if (src.theme === 'light' || src.theme === 'dark' || src.theme === 'system') {
      out.theme = src.theme
    }
  }
  return out
}
