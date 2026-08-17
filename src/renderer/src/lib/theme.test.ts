import { describe, expect, it } from 'vitest'
import {
  readThemePreference,
  resolveTheme,
  themeCatalog,
  themeScheme,
  THEME_STORAGE_KEY,
  writeThemePreference
} from './theme'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('theme', () => {
  it('follows the operating system when no supported preference is stored', () => {
    const storage = new MemoryStorage()
    expect(readThemePreference(storage)).toBe('system')

    storage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(readThemePreference(storage)).toBe('system')
  })

  it('persists and restores an explicit theme', () => {
    const storage = new MemoryStorage()
    writeThemePreference(storage, 'paper')

    expect(readThemePreference(storage)).toBe('paper')
  })

  it('migrates preferences that only named a colour scheme', () => {
    const storage = new MemoryStorage()
    storage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readThemePreference(storage)).toBe('midnight')

    storage.setItem(THEME_STORAGE_KEY, 'light')
    expect(readThemePreference(storage)).toBe('daylight')
  })

  it('keeps theme switching usable when storage is unavailable', () => {
    expect(readThemePreference({ getItem: () => { throw new Error('blocked') } })).toBe('system')
    expect(() => writeThemePreference({ setItem: () => { throw new Error('blocked') } }, 'tape'))
      .not.toThrow()
  })

  it('resolves the system preference against the media query result', () => {
    expect(resolveTheme('system', true)).toBe('midnight')
    expect(resolveTheme('system', false)).toBe('daylight')
  })

  it('keeps an explicit theme regardless of the media query result', () => {
    expect(resolveTheme('contrast', false)).toBe('contrast')
    expect(resolveTheme('paper', true)).toBe('paper')
  })

  it('exposes a colour scheme for every catalogued theme', () => {
    expect(themeCatalog.filter((theme) => theme.scheme === 'light')).not.toHaveLength(0)
    expect(themeCatalog.filter((theme) => theme.scheme === 'dark')).not.toHaveLength(0)

    for (const theme of themeCatalog) {
      expect(themeScheme(theme.id)).toBe(theme.scheme)
    }
  })
})
