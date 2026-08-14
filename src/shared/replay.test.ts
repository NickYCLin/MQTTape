import { describe, expect, it } from 'vitest'
import type { MqttMessageRecord, ReplayOptions } from './contracts'
import {
  MAX_REPLAY_DELAY_MS,
  replayDelay,
  replayTimingScale,
  selectReplayMessages
} from './replay'

function message(
  id: string,
  direction: MqttMessageRecord['direction'],
  timestamp: string
): MqttMessageRecord {
  return {
    id,
    direction,
    timestamp,
    topic: `demo/${id}`,
    qos: 0,
    retain: false,
    duplicate: false,
    payloadBase64: '',
    payloadText: '',
    size: 0
  }
}

const outgoingOnly: ReplayOptions = {
  includeIncoming: false,
  includeOutgoing: true,
  speed: 1
}

describe('replay planning', () => {
  it('selects only the requested directions in recorded order', () => {
    const messages = [
      message('one', 'incoming', '2026-01-01T00:00:00.000Z'),
      message('two', 'outgoing', '2026-01-01T00:00:01.000Z'),
      message('three', 'incoming', '2026-01-01T00:00:02.000Z')
    ]

    expect(selectReplayMessages(messages, outgoingOnly).map(({ id }) => id)).toEqual(['two'])
  })

  it('compresses long captures and applies replay speed', () => {
    const messages = [
      message('one', 'outgoing', '2026-01-01T00:00:00.000Z'),
      message('two', 'outgoing', '2026-01-01T00:01:00.000Z')
    ]
    const scale = replayTimingScale(messages)

    expect(scale).toBe(0.5)
    expect(replayDelay(messages[0].timestamp, messages[1].timestamp, scale, 2))
      .toBe(MAX_REPLAY_DELAY_MS)
  })

  it('treats invalid timing and speed safely', () => {
    expect(replayDelay('invalid', 'also-invalid', 1, 0)).toBe(0)
  })
})
