import { describe, expect, it } from 'vitest'
import { inspectLoRaWanUplink } from './lorawan'

describe('LoRaWAN uplink inspection', () => {
  it('recognizes The Things Stack uplinks and extracts radio metadata', () => {
    const inspection = inspectLoRaWanUplink(JSON.stringify({
      end_device_ids: {
        device_id: 'weather-node',
        application_ids: { application_id: 'field-station' },
        dev_eui: '0004A30B001C0530'
      },
      received_at: '2026-08-17T03:00:00Z',
      uplink_message: {
        f_port: 4,
        f_cnt: 43,
        frm_payload: 'DLIEgPeu',
        decoded_payload: { temperature: -21.3, battery: 3250 },
        rx_metadata: [{
          gateway_ids: { gateway_id: 'gtw1', eui: '9C5C8E00001A05C4' },
          rssi: -35,
          snr: 4.2
        }],
        settings: {
          data_rate: { lora: { bandwidth: 125000, spreading_factor: 7 } },
          frequency: '868100000'
        }
      }
    }))

    expect(inspection).toMatchObject({
      provider: 'the-things-stack',
      deviceId: 'weather-node',
      applicationId: 'field-station',
      devEui: '0004A30B001C0530',
      fPort: 4,
      frameCounter: 43,
      frequencyHz: 868100000,
      bandwidthHz: 125000,
      spreadingFactor: 7,
      framePayloadBase64: 'DLIEgPeu',
      decodedPayload: { temperature: -21.3, battery: 3250 },
      gateways: [{
        gatewayId: 'gtw1',
        gatewayEui: '9C5C8E00001A05C4',
        rssi: -35,
        snr: 4.2
      }]
    })
  })

  it('recognizes ChirpStack uplinks and extracts their embedded frame', () => {
    const inspection = inspectLoRaWanUplink(JSON.stringify({
      time: '2026-08-17T03:00:00Z',
      deviceInfo: {
        applicationId: '17c82e96-be03-4f38-aef3-f83d48582d97',
        applicationName: 'Field station',
        deviceName: 'Weather node',
        devEui: '0101010101010101'
      },
      dr: 1,
      fPort: 1,
      fCnt: 99,
      data: 'eyJ0ZW1wZXJhdHVyZSI6MjV9',
      object: { temperature: 25 },
      rxInfo: [{ gatewayId: '0016c001f153a14c', rssi: -36, snr: 10.5 }],
      txInfo: {
        frequency: 867100000,
        modulation: { lora: { bandwidth: 125000, spreadingFactor: 11 } }
      }
    }))

    expect(inspection).toMatchObject({
      provider: 'chirpstack',
      deviceName: 'Weather node',
      applicationName: 'Field station',
      devEui: '0101010101010101',
      fPort: 1,
      frameCounter: 99,
      dataRateIndex: 1,
      frequencyHz: 867100000,
      bandwidthHz: 125000,
      spreadingFactor: 11,
      framePayloadBase64: 'eyJ0ZW1wZXJhdHVyZSI6MjV9',
      decodedPayload: { temperature: 25 },
      gateways: [{ gatewayId: '0016c001f153a14c', rssi: -36, snr: 10.5 }]
    })
  })

  it('does not mistake ordinary or malformed JSON for a LoRaWAN uplink', () => {
    expect(inspectLoRaWanUplink('{"temperature":25}')).toBeNull()
    expect(inspectLoRaWanUplink('{not-json')).toBeNull()
    expect(inspectLoRaWanUplink(JSON.stringify({
      uplink_message: { frm_payload: 'not base64!' }
    }))).toBeNull()
    expect(inspectLoRaWanUplink(JSON.stringify({
      deviceInfo: { devEui: '0101010101010101' },
      data: 'not base64!'
    }))).toBeNull()
  })
})
