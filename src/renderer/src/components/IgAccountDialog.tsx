import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  ExternalLink,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound
} from 'lucide-react'
import { toast } from 'sonner'
import { toastError } from '@/lib/toast-error'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/primitives'
import { SmartImage } from '@/components/ui/smart-image'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useIgAccountStore } from '@/stores/ig-account'
import { useI18n } from '@/i18n'
import { errorMessage } from '@/lib/app-error'

/**
 * IG 账号面板：点击顶栏头像进入（而不是跳到设置）。
 *
 * 为什么独立成面板：账号相关的操作（查看身份、重新登录、退出、看权限说明）
 * 与"应用设置"是两类事。混在设置里会让用户在设置里找不到"我的账号"，
 * 也让设置面板臃肿。这里只放账号本身，并明确列出会话能做什么。
 */
export function IgAccountDialog({
  open,
  onClose,
  onLogin
}: {
  open: boolean
  onClose: () => void
  /** 复用 App 的登录流程（含 toast 与状态同步） */
  onLogin: () => Promise<void>
}) {
  const { t } = useI18n()
  const loggedIn = useIgAccountStore((s) => s.loggedIn)
  const profile = useIgAccountStore((s) => s.profile)
  const refresh = useIgAccountStore((s) => s.refresh)
  const setLoggedIn = useIgAccountStore((s) => s.setLoggedIn)
  const [busy, setBusy] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [status, setStatus] = useState<{
    persisted: boolean
    partition: boolean
  } | null>(null)

  useEffect(() => {
    if (!open) return
    void refresh()
    void window.instadown
      .igLoginStatus()
      .then((s) => setStatus({ persisted: s.persisted, partition: s.partition }))
      .catch(() => setStatus(null))
  }, [open, refresh])

  const handleReLogin = async () => {
    setBusy(true)
    try {
      await onLogin()
      await refresh()
      const s = await window.instadown.igLoginStatus()
      setStatus({ persisted: s.persisted, partition: s.partition })
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    setConfirmLogout(false)
    setBusy(true)
    try {
      await window.instadown.igLogout()
      setLoggedIn(null)
      setStatus({ persisted: false, partition: false })
      toast.success(t('account.loggedOut'))
      onClose()
    } catch (e) {
      toastError(t('common.errorDetail', { prefix: t('account.logoutFailed'), detail: errorMessage(e) }))
    } finally {
      setBusy(false)
    }
  }

  const openProfileInBrowser = () => {
    if (profile?.username) {
      void window.instadown.openExternal(`https://www.instagram.com/${profile.username}/`)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('account.title')}>
      <div className="space-y-5 p-5">
        {loggedIn && profile ? (
          <>
            {/* 身份卡片 */}
            <div className="flex items-center gap-3.5 rounded-xl border border-app bg-surface-hover/50 p-4">
              <SmartImage
                src={profile.avatar}
                alt={profile.username}
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-emerald-500/30"
                fallbackClassName="h-14 w-14 shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-app">
                    @{profile.username || t('account.unknownAccount')}
                  </span>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                </div>
                <div className="mt-0.5 text-xs text-muted">{t('account.connected')}</div>
              </div>
              <Button variant="outline" size="sm" onClick={openProfileInBrowser} title={t('account.openProfile')}>
                <ExternalLink className="h-3.5 w-3.5" /> {t('account.profileShort')}
              </Button>
            </div>

            {/* 会话能力说明：让用户知道登录带来了什么 */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
                <Sparkles className="h-3.5 w-3.5" /> {t('account.capabilities')}
              </div>
              <ul className="space-y-1.5 rounded-lg border border-app bg-surface-hover/30 p-3">
                <CapabilityRow label={t('account.capProfile')} hint={t('account.capProfileHint')} enabled />
                <CapabilityRow label={t('account.capStories')} hint={t('account.capStoriesHint')} enabled />
                <CapabilityRow
                  label={t('account.capPrivate')}
                  hint={t('account.capPrivateHint')}
                  enabled
                />
              </ul>
            </section>

            {/* 会话使用策略：用户最关心的账号安全问题，必须写清楚 */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
                <ShieldCheck className="h-3.5 w-3.5" /> {t('account.policyTitle')}
              </div>
              <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-[11px] leading-relaxed">
                <p className="text-app">
                  <span className="font-medium">{t('account.policyNever')}</span>
                  {t('account.policyNeverBody')}
                </p>
                <p className="text-muted">{t('account.policyOnly')}</p>
                <p className="text-subtle">{t('account.policyRollback')}</p>
              </div>
            </section>

            {/* 会话状态（供排查问题） */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
                <ShieldCheck className="h-3.5 w-3.5" /> {t('account.sessionStatus')}
              </div>
              <div className="space-y-1.5 rounded-lg border border-app bg-surface-hover/30 p-3 text-[11px]">
                <StatusRow label={t('account.statusPersisted')} ok={status?.persisted ?? false} okText={t('account.sessionValid')} badText={t('account.sessionInvalid')} />
                <StatusRow label={t('account.statusPartition')} ok={status?.partition ?? false} okText={t('account.sessionValid')} badText={t('account.sessionInvalid')} />
                <p className="pt-1 leading-relaxed text-subtle">{t('account.statusEncryptedNote')}</p>
              </div>
            </section>

            {/* 操作 */}
            <div className="flex items-center justify-end gap-2 border-t border-app pt-3">
              <Button variant="secondary" size="sm" onClick={() => void handleReLogin()} disabled={busy}>
                <RefreshCw className="h-3.5 w-3.5" /> {busy ? t('account.processing') : t('account.relogin')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmLogout(true)} disabled={busy}>
                <LogOut className="h-3.5 w-3.5" /> {t('account.logout')}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* 未登录态：说明 + 直接登录 */}
            <div className="flex flex-col items-center py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover">
                <UserRound className="h-7 w-7 text-subtle" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-app">{t('account.notLoggedInTitle')}</h3>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
                {t('account.notLoggedInHint')}
              </p>
              <Button
                variant="primary"
                className="mt-4 w-full max-w-xs"
                onClick={() => void handleReLogin()}
                disabled={busy}
              >
                <LogIn className="h-4 w-4" /> {busy ? t('account.waitingLogin') : t('account.login')}
              </Button>
              <p className="mt-2.5 text-[11px] leading-relaxed text-subtle">
                {t('account.credentialsNote')}
              </p>
            </div>
          </>
        )}
      </div>

      {/* 退出登录：会清掉本机会话，需用户确认 */}
      <ConfirmDialog
        open={confirmLogout}
        title={t('settings.confirmLogoutTitle')}
        message={t('settings.confirmLogoutBody')}
        confirmLabel={t('settings.logoutLabel')}
        onConfirm={() => void handleLogout()}
        onCancel={() => setConfirmLogout(false)}
      />
    </Dialog>
  )
}

function CapabilityRow({
  label,
  hint,
  enabled
}: {
  label: string
  hint: string
  enabled: boolean
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={
          enabled
            ? 'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500'
            : 'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-surface-active'
        }
      />
      <div className="min-w-0">
        <div className="text-xs text-app">{label}</div>
        <div className="text-[11px] text-subtle">{hint}</div>
      </div>
    </li>
  )
}

function StatusRow({ label, ok, okText, badText }: { label: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
        {ok ? okText : badText}
      </span>
    </div>
  )
}
