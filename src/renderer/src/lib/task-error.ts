import type { TFn } from '@/i18n'

/**
 * 任务失败的友好文案：把网络栈/HTTP 的专业术语翻译成"发生了什么 +
 * 用户能做什么"。原始错误保留在 title 提示里供排查。
 */

export function friendlyTaskError(raw: string | null | undefined, t: TFn): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (/ERR_INTERNET_DISCONNECTED/i.test(s)) return t('task.errOffline')
  if (/ERR_(CONNECTION_(CLOSED|RESET|ABORTED|REFUSED)|TIMED_OUT|ECONNRESET|EPIPE|ETIMEDOUT)/i.test(s)) {
    return t('task.errNetwork')
  }
  if (/ERR_NAME_NOT_RESOLVED/i.test(s)) return t('task.errDns')
  if (/\b403\b/.test(s)) return t('task.errForbidden')
  if (/\b404\b|\b410\b/.test(s)) return t('task.errGone')
  return t('task.errGeneric')
}
