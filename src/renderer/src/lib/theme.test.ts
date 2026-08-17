import { describe, expect, it } from 'vitest'
import {
  readThemePreference,
  resolveTheme,
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

  it('persists and restores an explicit preference', () => {
    const storage = new MemoryStorage()
    writeThemePreference(storage, 'light')

    expect(readThemePreference(storage)).toBe('light')
  })

  it('keeps theme switching usable when storage is unavailable', () => {
    expect(readThemePreference({ getItem: () => { throw new Error('blocked') } })).toBe('system')
    expect(() => writeThemePreference({ setItem: () => { throw new Error('blocked') } }, 'dark'))
      .not.toThrow()
  })

  it('resolves the system preference against the media query result', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
})
