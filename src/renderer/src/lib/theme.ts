import { useEffect, useState } from 'react'
import type { ThemeMode } from '@shared/types'
import { useSettingsStore } from '@/stores/settings'

/**
 * 主题应用：把 ThemeMode 解析为实际的 light/dark 并切换 <html class="dark">。
 * - 'light'  → 移除 .dark
 * - 'dark'   → 添加 .dark
 * - 'system' → 跟随 prefers-color-scheme，并监听系统变化实时切换
 */

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

function systemPrefersDark(): boolean {
  return window.matchMedia(SYSTEM_DARK_QUERY).matches
}

/** 把 ThemeMode 解析为布尔值（'system' 时读取系统偏好） */
export function resolveIsDark(theme: ThemeMode): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return systemPrefersDark()
}

export function useApplyTheme(): void {
  const theme: ThemeMode = useSettingsStore((s) => s.settings?.theme ?? 'light')

  useEffect(() => {
    const root = document.documentElement
    const mql = window.matchMedia(SYSTEM_DARK_QUERY)

    const apply = (override?: boolean) => {
      const dark = override ?? resolveIsDark(theme)
      // 抑制切换瞬间的过渡：.dark 翻转会同时改动全元素的 background/
      // border/color，元素上的 transition-colors 会一起播放，主题切换
      // 呈现为整页渐变涂抹而非干脆的快照。注入禁用样式 → 强制重排 →
      // 下一帧移除。
      const style = document.createElement('style')
      style.textContent = '*,*::before,*::after{transition:none !important}'
      document.head.appendChild(style)
      root.classList.toggle('dark', dark)
      root.style.colorScheme = dark ? 'dark' : 'light'
      void root.offsetHeight
      requestAnimationFrame(() => style.remove())
    }
    apply()

    // 主进程广播的权威值：'system' → light/dark 切换时，themeSource 变化
    // 会更新渲染层的 prefers-color-scheme，但 Electron 不派发 change 事件，
    // 且切换瞬间本地读取的还是旧值（界面会卡在旧主题）。以广播为准修正。
    const offNative = window.instadown.onNativeTheme((dark) => apply(dark))

    if (theme !== 'system') return offNative
    // 系统主题变化时实时跟随
    const onChange = () => apply()
    mql.addEventListener('change', onChange)
    return () => {
      mql.removeEventListener('change', onChange)
      offNative()
    }
  }, [theme])
}

/**
 * 返回当前是否为深色（响应式：主题设置或系统偏好变化时更新）。
 * 供需要按主题渲染 JS 属性/样式的组件使用（如 sonner Toaster 的 theme 属性）。
 */
export function useIsDark(): boolean {
  const theme: ThemeMode = useSettingsStore((s) => s.settings?.theme ?? 'light')
  const [isDark, setIsDark] = useState(() => resolveIsDark(theme))

  useEffect(() => {
    setIsDark(resolveIsDark(theme))
    // 主进程广播兜底：themeSource 切换不派发 matchMedia change 事件，
    // 渲染层需以权威值修正（详见 useApplyTheme 注释）
    const offNative = window.instadown.onNativeTheme((dark) => setIsDark(dark))
    if (theme !== 'system') return offNative
    const mql = window.matchMedia(SYSTEM_DARK_QUERY)
    const onChange = () => setIsDark(systemPrefersDark())
    mql.addEventListener('change', onChange)
    return () => {
      mql.removeEventListener('change', onChange)
      offNative()
    }
  }, [theme])

  return isDark
}
