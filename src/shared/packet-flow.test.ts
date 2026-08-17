import { describe, expect, it } from 'vitest'
import type { MqttPacketDirection, MqttPacketEvent, MqttPacketFlowRecord } from './contracts'
import {
  createMqttPacketEvent,
  filterMqttPacketFlows,
  nextExpectedPacketCommand,
  packetFlowDurationMilliseconds,
  updateMqttPacketFlows
} from './packet-flow'

function event(
  id: string,
  direction: MqttPacketDirection,
  command: MqttPacketEvent['command'],
  timestamp: string,
  overrides: Partial<MqttPacketEvent> = {}
): MqttPacketEvent {
  return { id, direction, command, timestamp, ...overrides }
}

function apply(events: MqttPacketEvent[]): MqttPacketFlowRecord[] {
  return events.reduce(updateMqttPacketFlows, [] as MqttPacketFlowRecord[])
}

describe('MQTT QoS packet flow tracking', () => {
  it('tracks an outgoing QoS 1 publish through PUBACK', () => {
    const flows = apply([
      event('publish', 'sent', 'publish', '2026-08-17T08:00:00.000Z', {
        messageId: 10,
        qos: 1,
        topic: 'devices/one'
      }),
      event('ack', 'received', 'puback', '2026-08-17T08:00:00.025Z', {
        messageId: 10,
        reasonCode: 0
      })
    ])

    expect(flows).toHaveLength(1)
    expect(flows[0]).toMatchObject({
      messageDirection: 'outgoing',
      messageId: 10,
      topic: 'devices/one',
      qos: 1,
      state: 'completed'
    })
    expect(flows[0].steps.map(({ command, direction }) => ({ command, direction }))).toEqual([
      { command: 'publish', direction: 'sent' },
      { command: 'puback', direction: 'received' }
    ])
    expect(packetFlowDurationMilliseconds(flows[0])).toBe(25)
    expect(nextExpectedPacketCommand(flows[0])).toBeUndefined()
  })

  it('tracks an incoming QoS 2 publish through the four-step handshake', () => {
    const flows = apply([
      event('publish', 'received', 'publish', '2026-08-17T08:00:00.000Z', {
        messageId: 22,
        qos: 2,
        topic: 'devices/two'
      }),
      event('rec', 'sent', 'pubrec', '2026-08-17T08:00:00.005Z', { messageId: 22 }),
      event('rel', 'received', 'pubrel', '2026-08-17T08:00:00.010Z', { messageId: 22 }),
      event('comp', 'sent', 'pubcomp', '2026-08-17T08:00:00.015Z', { messageId: 22 })
    ])

    expect(flows[0].messageDirection).toBe('incoming')
    expect(flows[0].state).toBe('completed')
    expect(flows[0].steps.map(({ command }) => command))
      .toEqual(['publish', 'pubrec', 'pubrel', 'pubcomp'])
  })

  it('marks MQTT 5 failure reason codes and leaves unfinished flows pending', () => {
    const failed = apply([
      event('publish', 'sent', 'publish', '2026-08-17T08:00:00.000Z', {
        messageId: 30,
        qos: 2,
        topic: 'devices/failure'
      }),
      event('rec', 'received', 'pubrec', '2026-08-17T08:00:00.004Z', {
        messageId: 30,
        reasonCode: 0x80
      })
    ])
    const pending = apply([
      event('publish', 'sent', 'publish', '2026-08-17T08:00:00.000Z', {
        messageId: 31,
        qos: 1,
        topic: 'devices/pending'
      })
    ])

    expect(failed[0].state).toBe('failed')
    expect(failed[0].steps[1].reasonCode).toBe(0x80)
    expect(pending[0].state).toBe('pending')
    expect(nextExpectedPacketCommand(pending[0])).toBe('puback')
  })

  it('keeps duplicate retransmissions in the same pending flow', () => {
    const flows = apply([
      event('publish', 'sent', 'publish', '2026-08-17T08:00:00.000Z', {
        messageId: 40,
        qos: 1,
        topic: 'devices/retry'
      }),
      event('retry', 'sent', 'publish', '2026-08-17T08:00:01.000Z', {
        messageId: 40,
        qos: 1,
        topic: 'devices/retry',
        duplicate: true
      })
    ])

    expect(flows).toHaveLength(1)
    expect(flows[0].steps).toHaveLength(2)
    expect(flows[0].steps[1].duplicate).toBe(true)
  })

  it('normalizes only packet commands used by publish flows', () => {
    expect(createMqttPacketEvent({
      cmd: 'publish',
      messageId: 7,
      qos: 1,
      topic: 'demo',
      dup: false
    }, 'sent', '2026-08-17T08:00:00.000Z', 'packet')).toEqual({
      id: 'packet',
      timestamp: '2026-08-17T08:00:00.000Z',
      direction: 'sent',
      command: 'publish',
      messageId: 7,
      qos: 1,
      topic: 'demo',
      duplicate: false
    })
    expect(createMqttPacketEvent({ cmd: 'pingreq' }, 'sent')).toBeUndefined()
  })

  it('filters by topic, Packet ID, command, direction, or state', () => {
    const flows = apply([
      event('one', 'sent', 'publish', '2026-08-17T08:00:00.000Z', {
        messageId: 51,
        qos: 1,
        topic: 'factory/line-one'
      }),
      event('two', 'received', 'publish', '2026-08-17T08:00:01.000Z', {
        messageId: 52,
        qos: 2,
        topic: 'factory/line-two'
      }),
      event('rec', 'sent', 'pubrec', '2026-08-17T08:00:01.010Z', { messageId: 52 })
    ])

    expect(filterMqttPacketFlows(flows, 'line-one')).toHaveLength(1)
    expect(filterMqttPacketFlows(flows, '52')).toHaveLength(1)
    expect(filterMqttPacketFlows(flows, 'pubrec')).toHaveLength(1)
    expect(filterMqttPacketFlows(flows, 'incoming')).toHaveLength(1)
  })
})
