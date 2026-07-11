/** 日夜主题:解析系统偏好与用户手动设置 */

export type Theme = 'light' | 'dark'
/** auto = 跟随系统 */
export type ThemeSetting = Theme | 'auto'

const STORAGE_KEY = 'gmaps-clone-theme'

/** 读取系统深色模式偏好 */
export function getSystemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 从 localStorage 读取用户设置(无效值回退 auto) */
export function loadThemeSetting(): ThemeSetting {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'light' || raw === 'dark' ? raw : 'auto'
}

export function saveThemeSetting(setting: ThemeSetting): void {
  if (setting === 'auto') localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, setting)
}

/** 把设置解析为实际主题 */
export function resolveTheme(setting: ThemeSetting, systemTheme: Theme): Theme {
  return setting === 'auto' ? systemTheme : setting
}
