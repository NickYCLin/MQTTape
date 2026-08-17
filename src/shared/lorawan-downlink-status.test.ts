import { describe, expect, it } from 'vitest'
import type { MqttMessageRecord } from './contracts'
import {
  buildLoRaWanDownlinkTracks,
  buildLoRaWanDownlinkTracksFromEvents,
  inspectLoRaWanDownlinkEvents
} from './lorawan-downlink-status'

function message(
  id: string,
  direction: MqttMessageRecord['direction'],
  timestamp: string,
  topic: string,
  payload: unknown
): MqttMessageRecord {
  const payloadText = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return {
    id,
    direction,
    timestamp,
    topic,
    qos: 0,
    retain: false,
    duplicate: false,
    payloadBase64: '',
    payloadText,
    size: payloadText.length
  }
}

describe('LoRaWAN downlink status tracking', () => {
  it('links The Things Stack request and lifecycle events by correlation ID', () => {
    const messages = [
      message('request', 'outgoing', '2026-08-17T01:00:00.000Z',
        'v3/field-station@ttn/devices/weather-node/down/push', {
          downlinks: [{
            f_port: 15,
            frm_payload: 'vu8=',
            confirmed: true,
            correlation_ids: ['mqttape:test-downlink']
          }]
        }),
      message('queued', 'incoming', '2026-08-17T01:00:01.000Z',
        'v3/field-station@ttn/devices/weather-node/down/queued', {
          end_device_ids: { device_id: 'weather-node', dev_eui: '4200000000000000' },
          correlation_ids: ['as:downlink:generated', 'mqttape:test-downlink'],
          received_at: '2026-08-17T01:00:00.900Z',
          downlink_queued: {
            f_port: 15,
            f_cnt: 10,
            confirmed: true,
            correlation_ids: ['mqttape:test-downlink']
          }
        }),
      message('sent', 'incoming', '2026-08-17T01:00:02.000Z',
        'v3/field-station@ttn/devices/weather-node/down/sent', {
          correlation_ids: ['mqttape:test-downlink'],
          downlink_sent: { f_port: 15, f_cnt: 10, confirmed: true }
        }),
      message('ack', 'incoming', '2026-08-17T01:00:04.000Z',
        'v3/field-station@ttn/devices/weather-node/down/ack', {
          correlation_ids: ['mqttape:test-downlink'],
          downlink_ack: { f_port: 15, f_cnt: 10, confirmed: true }
        })
    ]

    const tracks = buildLoRaWanDownlinkTracks(messages)

    expect(tracks).toHaveLength(1)
    expect(tracks[0]).toMatchObject({
      provider: 'the-things-stack',
      applicationId: 'field-station@ttn',
      deviceId: 'weather-node',
      devEui: '4200000000000000',
      status: 'acknowledged',
      correlationBasis: 'correlation-id',
      correlationId: 'mqttape:test-downlink'
    })
    expect(tracks[0].events.map(({ kind }) => kind))
      .toEqual(['request', 'queued', 'sent', 'ack'])
  })

  it('continues correlation when persisted request and new feedback come from separate sessions', () => {
    const persisted = inspectLoRaWanDownlinkEvents(message(
      'request',
      'outgoing',
      '2026-08-17T01:00:00.000Z',
      'v3/app/devices/device/down/push',
      { downlinks: [{ f_port: 2, correlation_ids: ['mqttape:restored'] }] }
    ))
    const observedAfterRestart = inspectLoRaWanDownlinkEvents(message(
      'ack',
      'incoming',
      '2026-08-17T01:05:00.000Z',
      'v3/app/devices/device/down/ack',
      {
        correlation_ids: ['mqttape:restored'],
        downlink_ack: { f_port: 2, correlation_ids: ['mqttape:restored'] }
      }
    ))

    const tracks = buildLoRaWanDownlinkTracksFromEvents([
      ...persisted,
      ...observedAfterRestart
    ])

    expect(tracks).toHaveLength(1)
    expect(tracks[0].status).toBe('acknowledged')
    expect(tracks[0].events.map(({ kind }) => kind)).toEqual(['request', 'ack'])
  })

  it('extracts The Things Stack failure details', () => {
    const [event] = inspectLoRaWanDownlinkEvents(message(
      'failed',
      'incoming',
      '2026-08-17T01:00:00.000Z',
      'v3/field-station/devices/weather-node/down/failed',
      {
        correlation_ids: ['mqttape:failure'],
        downlink_failed: {
          f_port: 5,
          error: { message: 'no gateway available', code: 'resource_exhausted' }
        }
      }
    ))

    expect(event).toMatchObject({
      kind: 'failed',
      status: 'failed',
      fPort: 5,
      error: 'no gateway available · resource_exhausted'
    })
  })

  it('uses device order for the first ChirpStack txack, then queueItemId for ack', () => {
    const tracks = buildLoRaWanDownlinkTracks([
      message('request', 'outgoing', '2026-08-17T02:00:00.000Z',
        'application/app-uuid/device/0101010101010101/command/down', {
          devEui: '0101010101010101', confirmed: true, fPort: 10, data: 'qg=='
        }),
      message('txack', 'incoming', '2026-08-17T02:00:02.000Z',
        'application/app-uuid/device/0101010101010101/event/txack', {
          time: '2026-08-17T02:00:01.900Z',
          deviceInfo: {
            applicationId: 'app-uuid', deviceName: 'Test device', devEui: '0101010101010101'
          },
          queueItemId: '42cb6459-a640-46ec-9623-bdff39dc4736',
          fCntDown: 2
        }),
      message('ack', 'incoming', '2026-08-17T02:00:04.000Z',
        'application/app-uuid/device/0101010101010101/event/ack', {
          time: '2026-08-17T02:00:03.900Z',
          deviceInfo: {
            applicationId: 'app-uuid', deviceName: 'Test device', devEui: '0101010101010101'
          },
          queueItemId: '42cb6459-a640-46ec-9623-bdff39dc4736',
          acknowledged: false,
          fCntDown: 2
        })
    ])

    expect(tracks).toHaveLength(1)
    expect(tracks[0]).toMatchObject({
      provider: 'chirpstack',
      deviceId: 'Test device',
      devEui: '0101010101010101',
      queueItemId: '42cb6459-a640-46ec-9623-bdff39dc4736',
      correlationBasis: 'device-order',
      status: 'not-acknowledged'
    })
    expect(tracks[0].events.map(({ kind }) => kind)).toEqual(['request', 'txack', 'ack'])
  })

  it('orders platform events by occurred time when broker observation order differs', () => {
    const tracks = buildLoRaWanDownlinkTracks([
      message('sent', 'incoming', '2026-08-17T04:00:02.000Z',
        'v3/app/devices/device/down/sent', {
          received_at: '2026-08-17T04:00:01.000Z',
          correlation_ids: ['mqttape:out-of-order'],
          downlink_sent: { f_cnt: 7 }
        }),
      message('ack', 'incoming', '2026-08-17T04:00:01.000Z',
        'v3/app/devices/device/down/ack', {
          received_at: '2026-08-17T04:00:03.000Z',
          correlation_ids: ['mqttape:out-of-order'],
          downlink_ack: { f_cnt: 7 }
        })
    ])

    expect(tracks[0].events.map(({ kind }) => kind)).toEqual(['sent', 'ack'])
    expect(tracks[0].status).toBe('acknowledged')
  })

  it('keeps unsupported topics and malformed payloads out of the tracker', () => {
    expect(inspectLoRaWanDownlinkEvents(message(
      'uplink', 'incoming', '2026-08-17T03:00:00.000Z',
      'v3/app/devices/device/up', { uplink_message: {} }
    ))).toEqual([])
    expect(inspectLoRaWanDownlinkEvents(message(
      'invalid', 'incoming', '2026-08-17T03:00:00.000Z',
      'v3/app/devices/device/down/ack', '{not json'
    ))).toEqual([])
  })
})
