import type {
  MqttLastWillConfig,
  MqttVersion,
  MqttWillPayloadFormat
} from './contracts'
import { publishTopicError } from './mqtt-topic'

export const MAX_MQTT_WILL_PAYLOAD_BYTES = 1024 * 1024
const MAX_UINT32 = 4_294_967_295

export interface MqttWillPacketProperties {
  willDelayInterval?: number
  payloadFormatIndicator?: boolean
  messageExpiryInterval?: number
  contentType?: string
}

export interface MqttWillPacketOptions {
  topic: string
  payload: Uint8Array
  qos: 0 | 1 | 2
  retain: boolean
  properties?: MqttWillPacketProperties
}

export function defaultMqttLastWill(): MqttLastWillConfig {
  return {
    enabled: false,
    topic: '',
    payload: '',
    payloadFormat: 'text',
    qos: 0,
    retain: false
  }
}

function normalizedHex(value: string): string {
  return value.replace(/[\s:_-]/g, '')
}

function decodeHex(value: string): Uint8Array {
  const normalized = normalizedHex(value)
  if (!/^[0-9a-f]*$/i.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Last Will Hex payload must contain complete byte pairs.')
  }
  return Uint8Array.from(
    { length: normalized.length / 2 },
    (_, index) => Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16)
  )
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/\s/g, '')
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) {
    throw new Error('Last Will payload is not valid Base64.')
  }
  const binary = atob(normalized)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function encodeMqttWillPayload(
  payload: string,
  format: MqttWillPayloadFormat
): Uint8Array {
  const bytes = format === 'text'
    ? new TextEncoder().encode(payload)
    : format === 'hex'
      ? decodeHex(payload)
      : decodeBase64(payload)
  if (bytes.byteLength > MAX_MQTT_WILL_PAYLOAD_BYTES) {
    throw new Error('Last Will payload exceeds the 1 MB limit.')
  }
  return bytes
}

function uint32Error(value: number | undefined, label: string): string | null {
  if (value === undefined) return null
  return Number.isInteger(value) && value >= 0 && value <= MAX_UINT32
    ? null
    : `${label} must be a whole number from 0 to 4,294,967,295.`
}

export function mqttLastWillError(
  will: MqttLastWillConfig | undefined,
  mqttVersion: MqttVersion
): string | null {
  if (!will?.enabled) return null
  const topic = will.topic.trim()
  const topicError = publishTopicError(topic)
  if (topicError) return topicError.replace(/^Publish/, 'Last Will')
  if (![0, 1, 2].includes(will.qos)) return 'Last Will QoS must be 0, 1, or 2.'
  try {
    encodeMqttWillPayload(will.payload, will.payloadFormat)
  } catch (reason) {
    return reason instanceof Error ? reason.message : String(reason)
  }
  if (mqttVersion === 5) {
    return uint32Error(will.willDelayInterval, 'Last Will Delay') ??
      uint32Error(will.messageExpiryInterval, 'Last Will Message Expiry')
  }
  return null
}

export function mqttLastWillOptions(
  will: MqttLastWillConfig | undefined,
  mqttVersion: MqttVersion
): MqttWillPacketOptions | undefined {
  if (!will?.enabled) return undefined
  const error = mqttLastWillError(will, mqttVersion)
  if (error) throw new Error(error)
  const properties = mqttVersion === 5
    ? {
        payloadFormatIndicator: will.payloadFormat === 'text',
        ...(will.willDelayInterval === undefined
          ? {}
          : { willDelayInterval: will.willDelayInterval }),
        ...(will.messageExpiryInterval === undefined
          ? {}
          : { messageExpiryInterval: will.messageExpiryInterval }),
        ...(will.contentType?.trim() ? { contentType: will.contentType.trim() } : {})
      }
    : undefined
  return {
    topic: will.topic.trim(),
    payload: encodeMqttWillPayload(will.payload, will.payloadFormat),
    qos: will.qos,
    retain: will.retain,
    ...(properties ? { properties } : {})
  }
}
