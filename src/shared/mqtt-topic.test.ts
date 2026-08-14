import { describe, expect, it } from 'vitest'
import { publishTopicError, remapTopic } from './mqtt-topic'

describe('MQTT publish topics', () => {
  it('rejects empty, wildcard, and null-character topics', () => {
    expect(publishTopicError('')).toBe('Publish topic is required.')
    expect(publishTopicError('sensors/+/state')).toContain('wildcards')
    expect(publishTopicError('sensors/#')).toContain('wildcards')
    expect(publishTopicError('sensors/\0state')).toContain('null')
    expect(publishTopicError('sensors/room/state')).toBeNull()
  })
})

describe('topic remapping', () => {
  it('replaces only a complete topic prefix boundary', () => {
    const rule = { fromPrefix: 'factory/one', toPrefix: 'lab/replay' }

    expect(remapTopic('factory/one', rule)).toBe('lab/replay')
    expect(remapTopic('factory/one/temperature', rule)).toBe('lab/replay/temperature')
    expect(remapTopic('factory/one-more/temperature', rule))
      .toBe('factory/one-more/temperature')
  })

  it('can prepend every topic or remove a matched prefix', () => {
    expect(remapTopic('devices/lamp', { fromPrefix: '', toPrefix: 'sandbox' }))
      .toBe('sandbox/devices/lamp')
    expect(remapTopic('production/devices/lamp', {
      fromPrefix: 'production/',
      toPrefix: ''
    })).toBe('devices/lamp')
  })
})
