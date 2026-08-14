import { describe, expect, it } from 'vitest'
import { isCaptureFile } from './capture'

describe('capture validation', () => {
  it('accepts a version 1 MQTTape capture', () => {
    expect(isCaptureFile({
      format: 'mqttape-capture',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      connection: {},
      messages: [{
        id: 'one',
        direction: 'incoming',
        topic: 'demo/topic',
        timestamp: '2026-01-01T00:00:00.000Z',
        qos: 1,
        retain: false,
        duplicate: false,
        payloadBase64: 'aGVsbG8=',
        payloadText: 'hello',
        size: 5
      }]
    })).toBe(true)
  })

  it('rejects unknown formats and malformed messages', () => {
    expect(isCaptureFile({ format: 'other', version: 1, messages: [] })).toBe(false)
    expect(isCaptureFile({
      format: 'mqttape-capture',
      version: 1,
      connection: {},
      messages: [{ topic: 42 }]
    })).toBe(false)
  })
})
