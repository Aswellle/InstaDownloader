import { useEffect, useState } from 'react'
import {
  Aperture,
  ChevronDown,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  Info,
  LogIn,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Star,
  Sun,
  Trash2,
  UserRound,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'
import { toastError } from '@/lib/toast-error'
import type { ThemeMode } from '@shared/types'
import { Dialog } from '@/components/ui/dialog'
import { Button, Input } from '@/components/ui/primitives'
import { GithubIcon } from '@/components/ui/github-icon'
import { useSettingsStore } from '@/stores/settings'
import { useIgAccountStore } from '@/stores/ig-account'
import { SmartImage } from '@/components/ui/smart-image'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useI18n } from '@/i18n'
import type { MessageKey } from '@/i18n/zh-CN'
import { GITHUB_REPO_LABEL, GITHUB_REPO_URL } from '@shared/repo'
import { cn, formatBytes } from '@/lib/utils'
import { errorMessage } from '@/lib/app-error'

const THEME_OPTIONS: Array<{ value: ThemeMode; labelKey: MessageKey; icon: typeof Sun }> = [
  { value: 'light', labelKey: 'settings.themeLight', icon: Sun },
  { value: 'dark', labelKey: 'settings.themeDark', icon: Moon },
  { value: 'system', labelKey: 'settings.themeSystem', icon: Monitor }
]

/**
 * 设置面板（docs/09）：按"分组 + 说明"组织，高级项折叠。
 *
 * 设计原则：
 * - 每个设置项都有一句说明它**影响什么**，而不是只给一个开关；
 * - 高级/有风险的操作（手动粘贴 Cookie、清空缓存、清空历史）折叠在
 *   「高级」区，并写明后果；
 * - 功能入口（打开下载目录、账号面板）就近放置，不让用户去别处找。
 */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const settings = useSettingsStore((s) => s.settings)
  const save = useSettingsStore((s) => s.save)
  const setIgLoggedIn = useIgAccountStore((s) => s.setLoggedIn)
  const [dir, setDir] = useState('')
  const [concurrency, setConcurrency] = useState(3)
  const [autoClipboard, setAutoClipboard] = useState(true)
  const [warnAccountUse, setWarnAccountUse] = useState(true)
  const [autoCacheImages, setAutoCacheImages] = useState(true)
  const [theme, setTheme] = useState<ThemeMode>('light')
  const [session, setSession] = useState('')
  const [hasSession, setHasSession] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [profile, setProfile] = useState<{ username: string; avatar: string } | null>(null)
  const [cache, setCache] = useState<{ files: number; bytes: number } | null>(null)
  const [historyCount, setHistoryCount] = useState(0)
  const [confirm, setConfirm] = useState<'cache' | 'history' | 'logout' | null>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (!open || !settings) return
    setDir(settings.downloadDir)
    setConcurrency(settings.concurrency)
    setAutoClipboard(settings.autoClipboard)
    setWarnAccountUse(settings.warnAccountUse)
    setAutoCacheImages(settings.autoCacheImages)
    setTheme(settings.theme)
    void window.instadown.getAppVersion().then(setVersion).catch(() => setVersion(''))
    void window.instadown.igLoginStatus().then((s) => {
      setHasSession(s.persisted)
      setProfile(s.profile ?? null)
    })
    void window.instadown.getImageCacheStats().then(setCache).catch(() => setCache(null))
    void window.instadown
      .getHistory()
      .then((h) => setHistoryCount(h.length))
      .catch(() => setHistoryCount(0))
  }, [open, settings])

  const flashSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  const chooseDir = async () => {
    const chosen = await window.instadown.chooseDirectory()
    if (chosen) {
      setDir(chosen)
      await save({ downloadDir: chosen })
      flashSaved()
    }
  }

  const openDir = async () => {
    try {
      const opened = await window.instadown.openDownloadDir()
      if (opened === null) toastError(t('settings.dirNotSet'))
    } catch (e) {
      toastError(t('common.errorDetail', { prefix: t('settings.dirOpenFailed'), detail: errorMessage(e) }))
    }
  }

  const pickTheme = async (next: ThemeMode) => {
    setTheme(next)
    await save({ theme: next })
    flashSaved()
  }

  const saveSession = async () => {
    await window.instadown.setSessionCookie(session.trim() || null)
    setSession('')
    setHasSession(Boolean(session.trim()))
    flashSaved()
  }

  /** 打开 IG 官方登录窗口；成功后 Cookie 已由主进程加密保存 */
  const handleLogin = async (reset = false) => {
    setLoggingIn(true)
    try {
      const res = reset ? await window.instadown.igResetAndLogin() : await window.instadown.igLogin()
      if (res.ok) {
        const prof = { username: res.username ?? '', avatar: res.avatar ?? '' }
        setHasSession(true)
        setProfile(prof)
        setIgLoggedIn(prof)
        toast.success(res.username ? t('settings.loginOk', { name: res.username }) : t('settings.loginOkPlain'), {
          description: t('settings.cookieSavedNote')
        })
      } else if (res.cancelled) {
        toast.info(t('settings.loginCancelled'))
      } else {
        toastError(t(res.reason === 'timeout' ? 'login.timeout' : 'settings.loginFailed'))
      }
    } catch (e) {
      toastError(t('common.errorDetail', { prefix: t('settings.loginError'), detail: errorMessage(e) }))
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    try {
      await window.instadown.igLogout()
      setHasSession(false)
      setProfile(null)
      setIgLoggedIn(null)
      toast.success(t('settings.loggedOut'))
    } catch (e) {
      toastError(t('common.errorDetail', { prefix: t('settings.logoutFailed'), detail: errorMessage(e) }))
    }
  }

  const clearCache = async () => {
    try {
      const n = await window.instadown.clearImageCache()
      setCache({ files: 0, bytes: 0 })
      setConfirm(null)
      toast.success(t('settings.cacheCleared', { n }), {
        description: t('settings.cacheClearedDesc')
      })
    } catch (e) {
      toastError(t('common.errorDetail', { prefix: t('settings.clearFailed'), detail: errorMessage(e) }))
    }
  }

  const clearHistory = async () => {
    try {
      await window.instadown.clearHistory()
      setHistoryCount(0)
      setConfirm(null)
      toast.success(t('settings.historyCleared'), { description: t('settings.historyClearedDesc') })
    } catch (e) {
      toastError(t('common.errorDetail', { prefix: t('settings.clearFailed'), detail: errorMessage(e) }))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("settings.title")}>
      <div className="space-y-6 p-5">
        {/* ───────────────────────── 外观 */}
        <Group icon={Palette} title={t("settings.appearance")} desc={t("settings.appearanceDesc")}>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = theme === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => void pickTheme(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs transition-colors',
                    active
                      ? 'border-rose-500 bg-rose-500/10 text-app'
                      : 'border-app text-muted hover:bg-surface-hover'
                  )}
                >
                  <Icon className={cn('h-4 w-4', active && 'text-rose-500')} />
                  {t(opt.labelKey)}
                </button>
              )
            })}
          </div>
        </Group>

        {/* ───────────────────────── 下载 */}
        <Group icon={Download} title={t("settings.download")} desc={t("settings.downloadDesc")}>
          <Field label={t("settings.downloadDir")} hint={t("settings.downloadDirHint")}>
            <div className="flex gap-2">
              <Input value={dir} readOnly className="flex-1 font-mono text-xs" />
              <Button variant="secondary" onClick={chooseDir} title={t("settings.chooseDir")}>
                <FolderOpen className="h-4 w-4" /> {t("settings.change")}
              </Button>
              <Button variant="outline" onClick={() => void openDir()} title={t("settings.openInFileManager")}>
                {t("library.openItem")}
              </Button>
            </div>
          </Field>

          <Field
            label={t("settings.concurrency")}
            hint={t("settings.concurrencyHint")}
          >
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={async () => {
                    setConcurrency(n)
                    await save({ concurrency: n })
                    flashSaved()
                  }}
                  title={n > 3 ? t("settings.concurrencyWarn", { n }) : t("settings.concurrencyOk", { n })}
                  className={cn(
                    'h-8 w-8 rounded-lg text-sm transition-colors',
                    n === concurrency
                      ? 'bg-rose-500 text-white'
                      : 'bg-surface-hover text-muted hover:bg-surface-active'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
        </Group>

        {/* ───────────────────────── 行为 */}
        <Group icon={Zap} title={t("settings.behavior")} desc={t("settings.behaviorDesc")}>
          <Toggle
            label={t("settings.autoClipboard")}
            hint={t("settings.autoClipboardHint")}
            checked={autoClipboard}
            onChange={async () => {
              const next = !autoClipboard
              setAutoClipboard(next)
              await save({ autoClipboard: next })
              flashSaved()
            }}
          />
        </Group>

        {/* ───────────────────────── 账号安全 */}
        <Group icon={ShieldCheck} title={t("settings.privacy")} desc={t("settings.privacyDesc")}>
          {/* 无登录优先是 worker 内置的抓取策略（匿名优先阶梯），不可关闭。
              作为固定说明展示，避免给出"可以关闭"的错误暗示。 */}
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-app">{t("settings.anonymousFirstLong")}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-muted">{t("settings.anonymousFirstLongHint")}</div>
              <div className="mt-0.5 text-[11px] text-subtle">{t("settings.anonymousFirstAlways")}</div>
            </div>
          </div>
          <Toggle
            label={t("settings.warnAccountUseLong")}
            hint={t("settings.warnAccountUseLongHint")}
            checked={warnAccountUse}
            onChange={async () => {
              const next = !warnAccountUse
              setWarnAccountUse(next)
              await save({ warnAccountUse: next })
              flashSaved()
            }}
          />
          <Toggle
            label={t("settings.autoCacheLong")}
            hint={t("settings.autoCacheLongHint")}
            checked={autoCacheImages}
            onChange={async () => {
              const next = !autoCacheImages
              setAutoCacheImages(next)
              await save({ autoCacheImages: next })
              flashSaved()
            }}
          />
        </Group>

        {/* ───────────────────────── 账号 */}
        <Group
          icon={UserRound}
          title={t("settings.account")}
          desc={t("settings.accountDescLong")}
        >
          {hasSession ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                {profile?.avatar ? (
                  <SmartImage
                    src={profile.avatar}
                    className="h-9 w-9 rounded-full object-cover"
                    fallbackClassName="h-9 w-9 rounded-full"
                  />
                ) : (
                  <UserRound className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-app">
                    {profile?.username ? t('settings.loggedInAsShort', { name: profile.username }) : t('settings.loggedInBadge')}
                  </div>
                  <div className="text-[11px] text-subtle">
                    {t("settings.sessionEncryptedNote")}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setConfirm('logout')}>
                {t("settings.logoutShort")}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-[11px] leading-relaxed text-subtle">
                {t("settings.notLoggedInGuide")}
              </p>
              <Button
                variant="primary"
                className="mt-2 w-full"
                onClick={() => void handleLogin()}
                disabled={loggingIn}
              >
                <LogIn className="h-4 w-4" /> {loggingIn ? t('settings.waitingLogin') : t('settings.login')}
              </Button>
            </>
          )}
        </Group>

        {/* ───────────────────────── 存储与数据 */}
        <Group icon={HardDrive} title={t("settings.storage")} desc={t("settings.storageDesc")}>
          <div className="space-y-2 rounded-lg border border-app bg-surface-hover/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                <Database className="h-3.5 w-3.5" /> {t("settings.imageCache")}
              </span>
              <span className="tabular-nums text-app">
                {cache ? `${t('settings.filesCount', { n: cache.files })} · ${formatBytes(cache.bytes)}` : t('settings.statsLoading')}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-subtle">
              {t("settings.cacheHint")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setConfirm('cache')}
              disabled={!cache || cache.files === 0}
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("settings.clearCache")}
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border border-app bg-surface-hover/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                <Info className="h-3.5 w-3.5" /> {t("history.title")}
              </span>
              <span className="tabular-nums text-app">{t("settings.recordsCount", { n: historyCount })}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-subtle">
              {t("settings.historyHint.pre")}<span className="font-medium text-muted">{t("settings.historyHint.bold")}</span>{t("settings.historyHint.post")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setConfirm('history')}
              disabled={historyCount === 0}
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("settings.clearHistory")}
            </Button>
          </div>
        </Group>

        {/* ───────────────────────── 高级（折叠） */}
        <AdvancedGroup title={t("settings.advanced")}>
          <Field
            label={t("settings.pasteCookie")}
            hint={t("settings.pasteCookieHint")}
          >
            <div className="flex gap-2">
              <Input
                value={session}
                onChange={(e) => setSession(e.target.value)}
                placeholder="sessionid=…"
                type="password"
                className="flex-1 font-mono text-xs"
              />
              <Button variant="secondary" onClick={saveSession} disabled={!session.trim()}>
                {t("common.save")}
              </Button>
            </div>
          </Field>
        </AdvancedGroup>

        {/* ───────────────────────── 关于 */}
        <Group icon={Info} title={t("settings.about")} desc={t("settings.aboutDesc")}>
          <div className="space-y-2 rounded-lg border border-app bg-surface-hover/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                <Aperture className="h-3.5 w-3.5 text-rose-500" /> InstaDownloader
              </span>
              <span className="tabular-nums text-app">{version ? `v${version}` : '—'}</span>
            </div>

            {/* 开源仓库入口：章鱼猫图标 + 地址 + star 请求 */}
            <button
              onClick={() => void window.instadown.openExternal(GITHUB_REPO_URL)}
              className="flex w-full items-center gap-2 rounded-md border border-app bg-surface px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
              title={t("settings.repoLinkTitle")}
            >
              <GithubIcon className="h-4 w-4 shrink-0 text-app" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-app">
                {GITHUB_REPO_LABEL}
              </span>
              <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            </button>

            <p className="text-[11px] leading-relaxed text-subtle">
              {t("settings.starPromptPre")}
              <span className="mx-0.5 inline-flex items-center gap-0.5 text-amber-500">
                <Star className="h-3 w-3" />Star
              </span>
              {t("settings.starPromptPost")}
            </p>
          </div>
        </Group>

        <div className="flex items-center justify-end gap-2 border-t border-app pt-3">
          {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">{t("settings.saved")}</span>}
          <Button variant="secondary" onClick={onClose}>
            {t("common.done")}
          </Button>
        </div>
      </div>

      {/* 破坏性操作确认：清空缓存 / 清空历史 / 退出登录 */}
      <ConfirmDialog
        open={confirm === 'cache'}
        title={t("settings.confirmCacheTitle")}
        message={
          cache
            ? t("settings.confirmCacheBody", { n: cache.files, size: formatBytes(cache.bytes) })
            : t("settings.confirmCacheBodyGeneric")
        }
        confirmLabel={t("common.confirm")}
        onConfirm={() => void clearCache()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'history'}
        title={t("settings.confirmHistoryTitle")}
        message={t("settings.confirmHistoryBody", { n: historyCount })}
        confirmLabel={t("common.confirm")}
        onConfirm={() => void clearHistory()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'logout'}
        title={t("settings.confirmLogoutTitle")}
        message={t("settings.confirmLogoutBody")}
        confirmLabel={t("settings.logoutLabel")}
        onConfirm={() => void handleLogout()}
        onCancel={() => setConfirm(null)}
      />
    </Dialog>
  )
}

// ─── 布局原语 ──────────────────────────────────────────────

function Group({
  icon: Icon,
  title,
  desc,
  children
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-app">{title}</h3>
          <p className="text-[11px] text-subtle">{desc}</p>
        </div>
      </div>
      <div className="space-y-3 pl-6">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">{hint}</p>}
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  tone = 'default'
}: {
  label: string
  hint: string
  checked: boolean
  onChange: () => void | Promise<void>
  /** safe=开启时绿色（该选项开着更安全）；default=常规主色 */
  tone?: 'default' | 'safe'
}) {
  const onColor = tone === 'safe' ? 'bg-emerald-500' : 'bg-rose-500'
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted">{label}</div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-subtle">{hint}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => void onChange()}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? onColor : 'bg-surface-active'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </button>
    </div>
  )
}

function AdvancedGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-lg border border-app">
      <button
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs font-medium text-muted">{title}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-subtle transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="space-y-3 border-t border-app px-3 py-3">{children}</div>}
    </section>
  )
}
