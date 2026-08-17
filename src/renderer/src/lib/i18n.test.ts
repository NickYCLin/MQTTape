import { describe, expect, it } from 'vitest'
import {
  LANGUAGE_STORAGE_KEY,
  readLanguage,
  translate,
  translateKnownMessage,
  writeLanguage
} from './i18n'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('i18n', () => {
  it('defaults to English when no supported language is stored', () => {
    const storage = new MemoryStorage()
    expect(readLanguage(storage)).toBe('en')

    storage.setItem(LANGUAGE_STORAGE_KEY, 'fr')
    expect(readLanguage(storage)).toBe('en')
  })

  it('persists and restores Traditional Chinese', () => {
    const storage = new MemoryStorage()
    writeLanguage(storage, 'zh-TW')

    expect(readLanguage(storage)).toBe('zh-TW')
  })

  it('keeps language switching usable when storage is unavailable', () => {
    expect(readLanguage({ getItem: () => { throw new Error('blocked') } })).toBe('en')
    expect(() => writeLanguage({ setItem: () => { throw new Error('blocked') } }, 'zh-TW'))
      .not.toThrow()
  })

  it('interpolates translated interface messages', () => {
    expect(translate('en', 'session.filterResult', { visible: 2, total: 5 }))
      .toBe('Showing 2 of 5 messages')
    expect(translate('zh-TW', 'session.filterResult', { visible: 2, total: 5 }))
      .toBe('顯示 5 則訊息中的 2 則')
    expect(translate('zh-TW', 'connection.protocolGuide.wss'))
      .toContain('8084 是部分 Broker 的常見預設')
  })

  it('localizes known validation and dynamic preset messages', () => {
    expect(translateKnownMessage('zh-TW', 'Publish topic is required.'))
      .toBe('必須輸入發布 Topic。')
    expect(translateKnownMessage('zh-TW', 'Replay presets are limited to 50.'))
      .toBe('重播預設最多只能有 50 個。')
    expect(translateKnownMessage('zh-TW', 'Applied “正式轉沙箱”.'))
      .toBe('已套用「正式轉沙箱」。')
    expect(translateKnownMessage(
      'zh-TW',
      'MQTT 5 publish properties require an MQTT 5 connection.'
    )).toBe('MQTT 5 發布屬性需要 MQTT 5 連線。')
  })

  it('keeps unknown broker errors unchanged', () => {
    expect(translateKnownMessage('zh-TW', 'ECONNREFUSED 127.0.0.1:1883'))
      .toBe('ECONNREFUSED 127.0.0.1:1883')
  })
})
