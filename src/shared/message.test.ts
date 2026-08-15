import { describe, expect, it } from 'vitest'
import {
  decodePayloadBytes,
  detectPayloadKind,
  filterMessages,
  formatBytes,
  formatHexDump,
  isProbablyBinaryText,
  prettyPayload
} from './message'
import type { MqttMessageRecord } from './contracts'

const message: MqttMessageRecord = {
  id: '1',
  direction: 'incoming',
  timestamp: '2026-01-01T00:00:00.000Z',
  topic: 'factory/temperature',
  qos: 1,
  retain: false,
  duplicate: false,
  payloadBase64: 'MjUuNA==',
  payloadText: '25.4',
  size: 4
}

describe('message utilities', () => {
  it('pretty prints JSON without changing plain text', () => {
    expect(prettyPayload('{"online":true}')).toBe('{\n  "online": true\n}')
    expect(prettyPayload('hello')).toBe('hello')
  })

  it('filters by topic and payload case-insensitively', () => {
    expect(filterMessages([message], 'TEMP')).toHaveLength(1)
    expect(filterMessages([message], '25.4')).toHaveLength(1)
    expect(filterMessages([message], 'humidity')).toHaveLength(0)
  })

  it('formats byte counts', () => {
    expect(formatBytes(12)).toBe('12 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('classifies empty, JSON, text, and binary payloads from their original bytes', () => {
    expect(detectPayloadKind('')).toBe('empty')
    expect(detectPayloadKind('eyJvbmxpbmUiOnRydWV9')).toBe('json')
    expect(detectPayloadKind('5rip6Kmm')).toBe('text')
    expect(detectPayloadKind('AP8QQQ==')).toBe('binary')
    expect(isProbablyBinaryText('\u0000data')).toBe(true)
    expect(isProbablyBinaryText('normal text')).toBe(false)
  })

  it('decodes bytes and formats an offset, hexadecimal, and ASCII dump', () => {
    expect([...decodePayloadBytes('AEH/IH4K')]).toEqual([0, 65, 255, 32, 126, 10])
    expect(formatHexDump('AEH/IH4K', 4)).toBe([
      '0000  00 41 FF 20  |.A. |',
      '0004  7E 0A        |~.  |'
    ].join('\n'))
    expect(formatHexDump('AEH/IH4K', 4, 4)).toContain('2 additional byte(s) not shown')
  })
})
