import { describe, expect, it } from 'vitest'
import {
  countMqttMessageProperties,
  isMqttMessageProperties,
  isMqttPublishProperties,
  mqttPublishPropertiesProtocolError,
  normalizeMqttPublishProperties,
  toMqttPublishPacketProperties,
  toMqttPublishProperties
} from './mqtt-properties'

const encodeBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64')

describe('MQTT 5 publish properties', () => {
  it('normalizes publish properties without losing duplicate user properties', () => {
    const properties = normalizeMqttPublishProperties({
      payloadFormatIndicator: 1,
      messageExpiryInterval: 120,
      topicAlias: 9,
      responseTopic: 'devices/replies',
      correlationData: Uint8Array.from([0xde, 0xad, 0xbe, 0xef]),
      userProperties: {
        source: ['gateway', 'integration-test'],
        region: 'tw'
      },
      subscriptionIdentifier: [7, 12],
      contentType: 'application/json'
    }, encodeBase64)

    expect(properties).toEqual({
      payloadFormatIndicator: true,
      messageExpiryInterval: 120,
      topicAlias: 9,
      responseTopic: 'devices/replies',
      correlationDataBase64: '3q2+7w==',
      userProperties: [
        { name: 'source', value: 'gateway' },
        { name: 'source', value: 'integration-test' },
        { name: 'region', value: 'tw' }
      ],
      subscriptionIdentifiers: [7, 12],
      contentType: 'application/json'
    })
    expect(countMqttMessageProperties(properties!)).toBe(11)
    expect(isMqttMessageProperties(properties)).toBe(true)
  })

  it('returns undefined when no supported property has a valid value', () => {
    expect(normalizeMqttPublishProperties({
      payloadFormatIndicator: 2,
      messageExpiryInterval: -1,
      topicAlias: 0,
      correlationData: 'not binary',
      userProperties: { invalid: 42 },
      subscriptionIdentifier: 0
    }, encodeBase64)).toBeUndefined()
  })

  it('validates MQTT property ranges and correlation data Base64', () => {
    expect(isMqttMessageProperties({ correlationDataBase64: '' })).toBe(true)
    expect(isMqttMessageProperties({ correlationDataBase64: 'not base64!' })).toBe(false)
    expect(isMqttMessageProperties({ topicAlias: 65_536 })).toBe(false)
    expect(isMqttMessageProperties({ responseTopic: 'devices/+' })).toBe(false)
    expect(isMqttMessageProperties({ subscriptionIdentifiers: [0] })).toBe(false)
    expect(isMqttMessageProperties({ userProperties: [{ name: 'source', value: 42 }] })).toBe(false)
  })

  it('filters receive-only metadata before replaying a publish', () => {
    expect(toMqttPublishProperties({
      payloadFormatIndicator: false,
      topicAlias: 9,
      subscriptionIdentifiers: [7, 12],
      responseTopic: 'devices/replies',
      userProperties: [{ name: 'source', value: 'mqttape' }]
    })).toEqual({
      payloadFormatIndicator: false,
      responseTopic: 'devices/replies',
      userProperties: [{ name: 'source', value: 'mqttape' }]
    })
  })

  it('serializes duplicate user properties and binary correlation data for MQTT.js', () => {
    const serialized = toMqttPublishPacketProperties({
      correlationDataBase64: '3q2+7w==',
      userProperties: [
        { name: 'source', value: 'mqttape' },
        { name: 'source', value: 'replay' },
        { name: '__proto__', value: 'safe' }
      ]
    }, (base64) => Buffer.from(base64, 'base64'))

    expect(serialized?.correlationData).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]))
    expect(serialized?.userProperties?.source).toEqual(['mqttape', 'replay'])
    expect(Object.hasOwn(serialized?.userProperties ?? {}, '__proto__')).toBe(true)
    expect(serialized?.userProperties?.__proto__).toBe('safe')
  })

  it('strictly validates outgoing properties and blocks them on MQTT 3.1.1', () => {
    expect(isMqttPublishProperties({ contentType: 'application/json' })).toBe(true)
    expect(isMqttPublishProperties({ topicAlias: 1 })).toBe(false)
    expect(mqttPublishPropertiesProtocolError(4, { contentType: 'application/json' }))
      .toBe('MQTT 5 publish properties require an MQTT 5 connection.')
    expect(mqttPublishPropertiesProtocolError(5, { contentType: 'application/json' }))
      .toBeUndefined()
  })
})
