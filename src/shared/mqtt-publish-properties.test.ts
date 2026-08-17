import { describe, expect, it } from 'vitest'
import { buildMqttPublishProperties, type MqttPublishPropertiesDraft } from './mqtt-publish-properties'

function draft(overrides: Partial<MqttPublishPropertiesDraft> = {}): MqttPublishPropertiesDraft {
  return {
    payloadFormat: 'unspecified',
    messageExpiryInterval: '',
    responseTopic: '',
    correlationDataFormat: 'text',
    correlationData: '',
    userProperties: [],
    contentType: '',
    ...overrides
  }
}

describe('MQTT 5 publish property editor', () => {
  it('builds every publish-safe property and preserves duplicate user properties', () => {
    expect(buildMqttPublishProperties(draft({
      payloadFormat: 'utf8',
      messageExpiryInterval: '120',
      responseTopic: 'devices/replies',
      correlationDataFormat: 'hex',
      correlationData: 'DE AD BE EF',
      userProperties: [
        { name: 'source', value: 'mqttape' },
        { name: 'source', value: 'integration' }
      ],
      contentType: 'application/json'
    }))).toEqual({
      ok: true,
      properties: {
        payloadFormatIndicator: true,
        messageExpiryInterval: 120,
        responseTopic: 'devices/replies',
        correlationDataBase64: '3q2+7w==',
        userProperties: [
          { name: 'source', value: 'mqttape' },
          { name: 'source', value: 'integration' }
        ],
        contentType: 'application/json'
      }
    })
  })

  it('supports text and Base64 correlation data', () => {
    expect(buildMqttPublishProperties(draft({
      correlationDataFormat: 'text',
      correlationData: '台灣'
    }))).toMatchObject({ ok: true, properties: { correlationDataBase64: '5Y+w54Gj' } })
    expect(buildMqttPublishProperties(draft({
      correlationDataFormat: 'base64',
      correlationData: ' 3q2+7w== '
    }))).toMatchObject({ ok: true, properties: { correlationDataBase64: '3q2+7w==' } })
  })

  it('rejects invalid expiry, response topic, Hex, and Base64 values', () => {
    expect(buildMqttPublishProperties(draft({ messageExpiryInterval: '4294967296' })))
      .toEqual({ ok: false, error: 'message-expiry-invalid' })
    expect(buildMqttPublishProperties(draft({ responseTopic: 'devices/+' })))
      .toMatchObject({ ok: false, error: 'response-topic-invalid' })
    expect(buildMqttPublishProperties(draft({
      correlationDataFormat: 'hex',
      correlationData: 'ABC'
    }))).toEqual({ ok: false, error: 'correlation-hex-invalid' })
    expect(buildMqttPublishProperties(draft({
      correlationDataFormat: 'base64',
      correlationData: 'not-base64'
    }))).toEqual({ ok: false, error: 'correlation-base64-invalid' })
  })

  it('returns no properties for an untouched editor', () => {
    expect(buildMqttPublishProperties(draft())).toEqual({ ok: true, properties: undefined })
    expect(buildMqttPublishProperties(draft({
      correlationDataFormat: 'base64',
      correlationData: '   '
    }))).toEqual({ ok: true, properties: undefined })
  })
})
