export const THEME_STORAGE_KEY = 'mqttape:theme:v1'

export const SYSTEM_PREFERENCE = 'system'

export const themeCatalog = [
  { id: 'midnight', scheme: 'dark' },
  { id: 'tape', scheme: 'dark' },
  { id: 'magenta', scheme: 'dark' },
  { id: 'contrast', scheme: 'dark' },
  { id: 'daylight', scheme: 'light' },
  { id: 'paper', scheme: 'light' }
] as const

export type ThemeId = typeof themeCatalog[number]['id']
export type ColorScheme = typeof themeCatalog[number]['scheme']
export type ThemePreference = typeof SYSTEM_PREFERENCE | ThemeId

export const DEFAULT_DARK_THEME: ThemeId = 'midnight'
export const DEFAULT_LIGHT_THEME: ThemeId = 'daylight'

// Preferences stored before the theme catalogue existed only named a colour scheme.
const legacyPreferences: Record<string, ThemePreference> = {
  dark: DEFAULT_DARK_THEME,
  light: DEFAULT_LIGHT_THEME
}

export function isThemeId(value: unknown): value is ThemeId {
  return themeCatalog.some((theme) => theme.id === value)
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === SYSTEM_PREFERENCE || isThemeId(value)
}

export function themeScheme(id: ThemeId): ColorScheme {
  return themeCatalog.find((theme) => theme.id === id)!.scheme
}

export function readThemePreference(storage: Pick<Storage, 'getItem'>): ThemePreference {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY)
    if (isThemePreference(stored)) return stored
    return (stored && legacyPreferences[stored]) || SYSTEM_PREFERENCE
  } catch {
    return SYSTEM_PREFERENCE
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

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ThemeId {
  if (preference !== SYSTEM_PREFERENCE) return preference
  return prefersDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME
}
