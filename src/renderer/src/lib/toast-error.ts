import { toast } from 'sonner'

/**
 * 错误提示包装：停留至用户手动关闭。
 *
 * 本应用没有通知中心/历史列表，错误 toast 若按默认 4 秒自动消失，
 * 用户稍一分神就再也找不回出错原因。成功/信息类提示仍用 sonner 默认时长。
 * 原始选项透传（description、action 等）。
 */
export function toastError(message: string, opts?: Parameters<typeof toast.error>[1]): void {
  toast.error(message, { duration: Infinity, ...opts })
}
