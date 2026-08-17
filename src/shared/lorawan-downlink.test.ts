import { describe, expect, it } from 'vitest'
import { buildLoRaWanDownlink, type LoRaWanDownlinkInput } from './lorawan-downlink'

const baseInput: LoRaWanDownlinkInput = {
  provider: 'the-things-stack',
  applicationId: 'field-station',
  deviceId: 'weather-node',
  fPort: 15,
  confirmed: false,
  payloadFormat: 'hex',
  payload: 'BE EF'
}

describe('LoRaWAN MQTT downlink builder', () => {
  it('builds a The Things Stack raw push with tenant and priority', () => {
    const result = buildLoRaWanDownlink({
      ...baseInput,
      tenantId: 'tenant1',
      confirmed: true,
      priority: 'HIGH'
    })

    expect(result).toEqual({
      ok: true,
      publication: {
        topic: 'v3/field-station@tenant1/devices/weather-node/down/push',
        payload: JSON.stringify({
          downlinks: [{
            f_port: 15,
            frm_payload: 'vu8=',
            priority: 'HIGH',
            confirmed: true
          }]
        }, null, 2),
        framePayloadBase64: 'vu8=',
        framePayloadBytes: 2
      }
    })
  })

  it('builds a The Things Stack decoded JSON queue replacement', () => {
    const result = buildLoRaWanDownlink({
      ...baseInput,
      operation: 'replace',
      payloadFormat: 'json',
      payload: '{"led":true}'
    })

    expect(result.ok && result.publication.topic)
      .toBe('v3/field-station/devices/weather-node/down/replace')
    expect(result.ok && JSON.parse(result.publication.payload)).toEqual({
      downlinks: [{
        f_port: 15,
        decoded_payload: { led: true },
        priority: 'NORMAL',
        confirmed: false
      }]
    })
  })

  it('builds ChirpStack raw and decoded downlinks', () => {
    const raw = buildLoRaWanDownlink({
      ...baseInput,
      provider: 'chirpstack',
      applicationId: '17c82e96-be03-4f38-aef3-f83d48582d97',
      deviceId: '01010101010101AA',
      fPort: 10,
      payloadFormat: 'text',
      payload: 'hello'
    })
    const decoded = buildLoRaWanDownlink({
      ...baseInput,
      provider: 'chirpstack',
      applicationId: '17c82e96-be03-4f38-aef3-f83d48582d97',
      deviceId: '01010101010101AA',
      payloadFormat: 'json',
      payload: '{"temperatureSensor":{"1":25}}'
    })

    expect(raw.ok && raw.publication).toMatchObject({
      topic: 'application/17c82e96-be03-4f38-aef3-f83d48582d97/device/01010101010101aa/command/down',
      framePayloadBase64: 'aGVsbG8=',
      framePayloadBytes: 5
    })
    expect(raw.ok && JSON.parse(raw.publication.payload)).toEqual({
      devEui: '01010101010101aa',
      confirmed: false,
      fPort: 10,
      data: 'aGVsbG8='
    })
    expect(decoded.ok && JSON.parse(decoded.publication.payload)).toEqual({
      devEui: '01010101010101aa',
      confirmed: false,
      fPort: 15,
      object: { temperatureSensor: { 1: 25 } }
    })
  })

  it('normalizes valid Base64 input', () => {
    const result = buildLoRaWanDownlink({
      ...baseInput,
      payloadFormat: 'base64',
      payload: ' AQID '
    })

    expect(result.ok && result.publication.framePayloadBase64).toBe('AQID')
    expect(result.ok && result.publication.framePayloadBytes).toBe(3)
  })

  it.each([
    [{ ...baseInput, applicationId: '' }, 'application-id-required'],
    [{ ...baseInput, applicationId: 'bad/app' }, 'application-id-invalid'],
    [{ ...baseInput, deviceId: '' }, 'device-id-required'],
    [{ ...baseInput, tenantId: 'bad tenant' }, 'tenant-id-invalid'],
    [{ ...baseInput, fPort: 234 }, 'f-port-invalid'],
    [{ ...baseInput, payload: '' }, 'payload-required'],
    [{ ...baseInput, payload: 'B E E' }, 'hex-invalid'],
    [{ ...baseInput, payloadFormat: 'base64' as const, payload: 'not base64!' }, 'base64-invalid'],
    [{ ...baseInput, payloadFormat: 'json' as const, payload: '[1, 2]' }, 'json-invalid'],
    [{
      ...baseInput,
      provider: 'chirpstack' as const,
      deviceId: 'not-a-dev-eui'
    }, 'dev-eui-invalid'],
    [{
      ...baseInput,
      provider: 'chirpstack' as const,
      deviceId: '0101010101010101',
      fPort: 256
    }, 'f-port-invalid']
  ] as const)('rejects invalid input %#', (input, error) => {
    expect(buildLoRaWanDownlink(input)).toEqual({ ok: false, error })
  })
})
