import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import {
  readThemePreference,
  resolveTheme,
  themeScheme,
  writeThemePreference,
  type ColorScheme,
  type ThemeId,
  type ThemePreference
} from './lib/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

interface ThemeContextValue {
  preference: ThemePreference
  theme: ThemeId
  scheme: ColorScheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => readThemePreference(window.localStorage)
  )
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia(DARK_QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const sync = (event: MediaQueryListEvent): void => setPrefersDark(event.matches)
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const theme = resolveTheme(preference, prefersDark)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setPreference = useCallback((nextPreference: ThemePreference): void => {
    writeThemePreference(window.localStorage, nextPreference)
    setPreferenceState(nextPreference)
  }, [])

  const context = useMemo<ThemeContextValue>(
    () => ({ preference, theme, scheme: themeScheme(theme), setPreference }),
    [preference, setPreference, theme]
  )

  return <ThemeContext.Provider value={context}>{children}</ThemeContext.Provider>
}

// This co-located hook keeps every consumer tied to the provider's private context.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.')
  return context
}
