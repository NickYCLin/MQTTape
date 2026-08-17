import type { MqttPublishProperties, MqttUserProperty } from './contracts'
import { decodePayloadBytes, encodePayloadBytes } from './message'
import { countMqttPublishProperties } from './mqtt-properties'
import { publishTopicError } from './mqtt-topic'

export type MqttPayloadFormatInput = 'unspecified' | 'utf8' | 'bytes'
export type MqttCorrelationDataFormat = 'text' | 'hex' | 'base64'

export interface MqttPublishPropertiesDraft {
  payloadFormat: MqttPayloadFormatInput
  messageExpiryInterval: string
  responseTopic: string
  correlationDataFormat: MqttCorrelationDataFormat
  correlationData: string
  userProperties: MqttUserProperty[]
  contentType: string
}

export type MqttPublishPropertiesDraftError =
  | 'message-expiry-invalid'
  | 'response-topic-invalid'
  | 'correlation-hex-invalid'
  | 'correlation-base64-invalid'

export type MqttPublishPropertiesBuildResult =
  | { ok: true; properties?: MqttPublishProperties }
  | { ok: false; error: MqttPublishPropertiesDraftError; detail?: string }

const MAXIMUM_MESSAGE_EXPIRY = 0xffff_ffff

function encodeCorrelationData(
  format: MqttCorrelationDataFormat,
  value: string
): { ok: true; base64: string } | { ok: false; error: MqttPublishPropertiesDraftError } {
  if (format === 'text') {
    return { ok: true, base64: encodePayloadBytes(new TextEncoder().encode(value)) }
  }

  if (format === 'hex') {
    const normalized = value.replace(/[\s:-]/g, '')
    if (!normalized || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(normalized)) {
      return { ok: false, error: 'correlation-hex-invalid' }
    }
    const bytes = Uint8Array.from(
      normalized.match(/.{2}/g) ?? [],
      (pair) => Number.parseInt(pair, 16)
    )
    return { ok: true, base64: encodePayloadBytes(bytes) }
  }

  const normalized = value.trim()
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) {
    return { ok: false, error: 'correlation-base64-invalid' }
  }
  try {
    return { ok: true, base64: encodePayloadBytes(decodePayloadBytes(normalized)) }
  } catch {
    return { ok: false, error: 'correlation-base64-invalid' }
  }
}

export function buildMqttPublishProperties(
  draft: MqttPublishPropertiesDraft
): MqttPublishPropertiesBuildResult {
  const properties: MqttPublishProperties = {}
  if (draft.payloadFormat === 'utf8') properties.payloadFormatIndicator = true
  if (draft.payloadFormat === 'bytes') properties.payloadFormatIndicator = false

  const expiry = draft.messageExpiryInterval.trim()
  if (expiry) {
    if (!/^\d+$/.test(expiry)) return { ok: false, error: 'message-expiry-invalid' }
    const seconds = Number(expiry)
    if (!Number.isSafeInteger(seconds) || seconds > MAXIMUM_MESSAGE_EXPIRY) {
      return { ok: false, error: 'message-expiry-invalid' }
    }
    properties.messageExpiryInterval = seconds
  }

  const responseTopic = draft.responseTopic.trim()
  if (responseTopic) {
    const detail = publishTopicError(responseTopic)
    if (detail) return { ok: false, error: 'response-topic-invalid', detail }
    properties.responseTopic = responseTopic
  }

  const hasCorrelationData = draft.correlationDataFormat === 'text'
    ? draft.correlationData.length > 0
    : draft.correlationData.trim().length > 0
  if (hasCorrelationData) {
    const encoded = encodeCorrelationData(draft.correlationDataFormat, draft.correlationData)
    if (!encoded.ok) return encoded
    properties.correlationDataBase64 = encoded.base64
  }

  const userProperties = draft.userProperties
    .filter(({ name, value }) => name.length > 0 || value.length > 0)
    .map(({ name, value }) => ({ name, value }))
  if (userProperties.length > 0) properties.userProperties = userProperties

  const contentType = draft.contentType.trim()
  if (contentType) properties.contentType = contentType

  return {
    ok: true,
    properties: countMqttPublishProperties(properties) > 0 ? properties : undefined
  }
}
