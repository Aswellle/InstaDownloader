import { useEffect, useRef, useState } from 'react'
import { Aperture, ClipboardPaste, Languages, LogIn, Search } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import { SmartImage } from '@/components/ui/smart-image'
import { GithubIcon } from '@/components/ui/github-icon'
import { useIgAccountStore } from '@/stores/ig-account'
import { useSettingsStore } from '@/stores/settings'
import { isProbablyIgUrl } from '@shared/ig-url'
import { GITHUB_REPO_URL } from '@shared/repo'
import { useI18n, type Locale } from '@/i18n'

/** 顶部：Logo + URL 输入（粘贴快捷键）+ 语言/账号入口（docs/09） */
export function TopBar({
  onParse,
  onAutoClipboard,
  onAccountClick,
  onLoginClick
}: {
  onParse: (input: string) => void
  onAutoClipboard: (text: string) => void
  /** 已登录：打开 IG 账号面板 */
  onAccountClick: () => void
  /** 未登录：直接打开 IG 登录窗口 */
  onLoginClick: () => void
}) {
  const [value, setValue] = useState('')
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const loggedIn = useIgAccountStore((s) => s.loggedIn)
  const profile = useIgAccountStore((s) => s.profile)
  /** 剪贴板自动检测开关（设置 → 行为）：关闭后完全不读取剪贴板 */
  const autoClipboard = useSettingsStore((s) => s.settings?.autoClipboard ?? true)
  const { t, locale, setLocale, followingSystem } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)

  // 窗口聚焦时检测剪贴板中的 IG 链接（参考产品"一键粘贴"体验的桌面化）。
  // 受设置开关控制：关闭时不读取剪贴板（隐私承诺，docs/11）。
  useEffect(() => {
    if (!autoClipboard) return
    let last = ''
    const check = async () => {
      try {
        const text = await window.instadown.readClipboard()
        if (text && text !== last && isProbablyIgUrl(text) && text.length < 500) {
          last = text
          onAutoClipboard(text)
        }
      } catch {
        /* 剪贴板不可用 */
      }
    }
    void check()
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [onAutoClipboard, autoClipboard])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 点击外部关闭语言下拉
  useEffect(() => {
    if (!langOpen) return
    const onDown = (e: MouseEvent) => {
      if (!langRef.current?.contains(e.target as Node)) setLangOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [langOpen])

  const submit = () => {
    if (value.trim()) onParse(value)
  }

  const paste = async () => {
    try {
      const text = await window.instadown.readClipboard()
      if (text) {
        setValue(text.trim())
        onParse(text.trim())
      }
    } catch {
      /* 忽略 */
    }
  }

  const pickLang = (l: Locale | null) => {
    setLocale(l)
    setLangOpen(false)
  }

  // 语言名以其自身文字显示（不随界面语言翻译）
  const langLabel: Record<Locale, string> = {
    'zh-CN': t('topBar.languageZh'),
    en: t('topBar.languageEn')
  }

  return (
    <div className="flex h-full items-center gap-3">
      <div className="flex shrink-0 items-center gap-2 pl-1">
        <Aperture className="h-5 w-5 text-rose-500" />
        <span className="text-sm font-semibold tracking-wide text-app">InstaDownloader</span>
        {/* 开源入口：章鱼猫图标 + Star 请求（悬停提示）。
            放在品牌名旁而不是角落 —— 它既是"项目从哪来"的标识，
            也是给用户的第一个 star 触点。 */}
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            e.preventDefault()
            void window.instadown.openExternal(GITHUB_REPO_URL)
          }}
          className="no-drag ml-0.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-muted transition-colors hover:bg-surface-hover hover:text-app"
          title={t('topBar.starTooltip')}
        >
          <GithubIcon className="h-4 w-4" />
          <span className="hidden text-xs sm:inline">{t('topBar.star')}</span>
        </a>
      </div>

      <div className="no-drag mx-auto flex min-w-0 w-full max-w-2xl items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder={t('topBar.placeholder')}
            aria-label={t('topBar.placeholder')}
            className="h-9 w-full rounded-lg border border-app bg-surface pl-9 pr-20 text-sm text-app placeholder:text-subtle focus-visible:border-rose-500/60 focus-visible:outline-none"
            spellCheck={false}
          />
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <button
            onClick={paste}
            className="absolute right-2 top-1/2 flex h-6 -translate-y-1/2 items-center gap-1 rounded-md bg-surface-hover px-2 text-xs text-muted hover:bg-surface-active"
            title={t('topBar.pasteTooltip')}
          >
            <ClipboardPaste className="h-3 w-3" /> {t('topBar.paste')}
          </button>
        </div>
        <Button variant="primary" size="md" onClick={submit} disabled={!value.trim()}>
          {t('topBar.parse')}
        </Button>
      </div>

      {/* 右侧：语言切换 + IG 账号入口。
          语言切换放在最右（窗口控制按钮左侧第一个可见控件），
          下拉里标注"跟随系统"状态；设置入口在左上角图标组。
          shrink-0 + 不换行：窗口较窄时由中间输入框让位 —— 此前右侧
          群组被弹性压缩，登录按钮文字被挤成两行。 */}
      <div className="no-drag flex shrink-0 items-center gap-2 pr-1">
        {/* 语言切换：地球图标 + 当前语言短名，下拉选择。
            需求要求入口在主窗口右侧且显眼 —— 图标 + 文字比纯图标可发现性高。 */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-app px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-app"
            title={t('topBar.language')}
            aria-haspopup="menu"
            aria-expanded={langOpen}
          >
            <Languages className="h-3.5 w-3.5" />
            <span className="max-w-20 truncate">{langLabel[locale]}</span>
            {followingSystem && <span className="text-subtle">·</span>}
          </button>
          {langOpen && (
            <div
              role="menu"
              className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-xl border border-app bg-surface py-1 shadow-2xl"
            >
              <button
                role="menuitem"
                onClick={() => pickLang('zh-CN')}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-surface-hover ${
                  locale === 'zh-CN' ? 'text-rose-600 dark:text-rose-400' : 'text-app'
                }`}
              >
                {t('topBar.languageZh')}
                {locale === 'zh-CN' && <span aria-hidden>✓</span>}
              </button>
              <button
                role="menuitem"
                onClick={() => pickLang('en')}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-surface-hover ${
                  locale === 'en' ? 'text-rose-600 dark:text-rose-400' : 'text-app'
                }`}
              >
                {t('topBar.languageEn')}
                {locale === 'en' && <span aria-hidden>✓</span>}
              </button>
              <div className="my-1 h-px bg-app-strong" />
              <button
                role="menuitem"
                onClick={() => pickLang(null)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-surface-hover ${
                  followingSystem ? 'text-rose-600 dark:text-rose-400' : 'text-muted'
                }`}
              >
                {t('settings.languageAuto')}
                {followingSystem && <span aria-hidden>✓</span>}
              </button>
            </div>
          )}
        </div>

        {loggedIn && profile ? (
          <button
            onClick={onAccountClick}
            className="flex items-center gap-2 rounded-full border border-app py-0.5 pl-0.5 pr-2.5 transition-colors hover:bg-surface-hover"
            title={t('topBar.accountTooltip', { name: profile.username })}
          >
            <SmartImage
              src={profile.avatar}
              className="h-6 w-6 rounded-full object-cover"
              fallbackClassName="h-6 w-6 rounded-full"
            />
            <span className="max-w-28 truncate text-xs font-medium text-app">
              {profile.username}
            </span>
          </button>
        ) : (
          <button
            onClick={onLoginClick}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-app px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-app"
            title={t('topBar.loginTooltip')}
          >
            <LogIn className="h-3.5 w-3.5" />
            {t('topBar.login')}
          </button>
        )}
      </div>
    </div>
  )
}
