export const THEME_STORAGE_KEY = 'mqttape:theme:v1'

export const supportedThemePreferences = ['system', 'light', 'dark'] as const

export type ThemePreference = typeof supportedThemePreferences[number]
export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string'
    && supportedThemePreferences.includes(value as ThemePreference)
}

export function readThemePreference(storage: Pick<Storage, 'getItem'>): ThemePreference {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function writeThemePreference(
  storage: Pick<Storage, 'setItem'>,
  preference: ThemePreference
): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // The current session can still switch themes when storage is unavailable.
  }
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean
): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light'
  return preference
}
