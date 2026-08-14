import { describe, expect, it } from 'vitest'
import { filterMessages, formatBytes, prettyPayload } from './message'
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
})
