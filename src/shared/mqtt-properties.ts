import type { MqttMessageProperties, MqttUserProperty } from './contracts'

export interface RawMqttPublishProperties {
  payloadFormatIndicator?: unknown
  messageExpiryInterval?: unknown
  topicAlias?: unknown
  responseTopic?: unknown
  correlationData?: unknown
  userProperties?: unknown
  subscriptionIdentifier?: unknown
  contentType?: unknown
}

type Base64Encoder = (bytes: Uint8Array) => string

const MAXIMUM_MESSAGE_EXPIRY = 0xffff_ffff
const MAXIMUM_TOPIC_ALIAS = 0xffff
const MAXIMUM_VARIABLE_BYTE_INTEGER = 0x0fff_ffff

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum
}

function normalizePayloadFormatIndicator(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 0) return false
  if (value === 1) return true
  return undefined
}

function normalizeUserProperties(value: unknown): MqttUserProperty[] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const properties = Object.entries(value).flatMap(([name, rawValue]) => {
    if (typeof rawValue === 'string') return [{ name, value: rawValue }]
    if (Array.isArray(rawValue)) {
      return rawValue
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => ({ name, value: entry }))
    }
    return []
  })
  return properties.length > 0 ? properties : undefined
}

function normalizeSubscriptionIdentifiers(value: unknown): number[] | undefined {
  const values = Array.isArray(value) ? value : [value]
  const identifiers = values.filter((entry): entry is number =>
    isIntegerInRange(entry, 1, MAXIMUM_VARIABLE_BYTE_INTEGER)
  )
  return identifiers.length > 0 ? identifiers : undefined
}

function normalizeCorrelationData(value: unknown, encodeBase64: Base64Encoder): string | undefined {
  if (!(value instanceof Uint8Array)) return undefined
  try {
    return encodeBase64(value)
  } catch {
    return undefined
  }
}

export function normalizeMqttPublishProperties(
  value: RawMqttPublishProperties | undefined,
  encodeBase64: Base64Encoder
): MqttMessageProperties | undefined {
  if (!value) return undefined

  const properties: MqttMessageProperties = {}
  const payloadFormatIndicator = normalizePayloadFormatIndicator(value.payloadFormatIndicator)
  const correlationDataBase64 = normalizeCorrelationData(value.correlationData, encodeBase64)
  const userProperties = normalizeUserProperties(value.userProperties)
  const subscriptionIdentifiers = normalizeSubscriptionIdentifiers(value.subscriptionIdentifier)

  if (payloadFormatIndicator !== undefined) {
    properties.payloadFormatIndicator = payloadFormatIndicator
  }
  if (isIntegerInRange(value.messageExpiryInterval, 0, MAXIMUM_MESSAGE_EXPIRY)) {
    properties.messageExpiryInterval = value.messageExpiryInterval
  }
  if (isIntegerInRange(value.topicAlias, 1, MAXIMUM_TOPIC_ALIAS)) {
    properties.topicAlias = value.topicAlias
  }
  if (typeof value.responseTopic === 'string') properties.responseTopic = value.responseTopic
  if (correlationDataBase64 !== undefined) properties.correlationDataBase64 = correlationDataBase64
  if (userProperties) properties.userProperties = userProperties
  if (subscriptionIdentifiers) properties.subscriptionIdentifiers = subscriptionIdentifiers
  if (typeof value.contentType === 'string') properties.contentType = value.contentType

  return countMqttMessageProperties(properties) > 0 ? properties : undefined
}

function isCanonicalBase64(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
}

export function isMqttMessageProperties(value: unknown): value is MqttMessageProperties {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const properties = value as MqttMessageProperties

  if (properties.payloadFormatIndicator !== undefined &&
      typeof properties.payloadFormatIndicator !== 'boolean') return false
  if (properties.messageExpiryInterval !== undefined &&
      !isIntegerInRange(properties.messageExpiryInterval, 0, MAXIMUM_MESSAGE_EXPIRY)) return false
  if (properties.topicAlias !== undefined &&
      !isIntegerInRange(properties.topicAlias, 1, MAXIMUM_TOPIC_ALIAS)) return false
  if (properties.responseTopic !== undefined && typeof properties.responseTopic !== 'string') return false
  if (properties.contentType !== undefined && typeof properties.contentType !== 'string') return false
  if (properties.correlationDataBase64 !== undefined &&
      (typeof properties.correlationDataBase64 !== 'string' ||
       !isCanonicalBase64(properties.correlationDataBase64))) return false
  if (properties.userProperties !== undefined &&
      (!Array.isArray(properties.userProperties) || properties.userProperties.some((property) =>
        !property || typeof property.name !== 'string' || typeof property.value !== 'string'
      ))) return false
  if (properties.subscriptionIdentifiers !== undefined &&
      (!Array.isArray(properties.subscriptionIdentifiers) ||
       properties.subscriptionIdentifiers.some((identifier) =>
         !isIntegerInRange(identifier, 1, MAXIMUM_VARIABLE_BYTE_INTEGER)
       ))) return false

  return true
}

export function countMqttMessageProperties(properties: MqttMessageProperties): number {
  let count = 0
  if (properties.payloadFormatIndicator !== undefined) count += 1
  if (properties.messageExpiryInterval !== undefined) count += 1
  if (properties.topicAlias !== undefined) count += 1
  if (properties.responseTopic !== undefined) count += 1
  if (properties.correlationDataBase64 !== undefined) count += 1
  count += properties.userProperties?.length ?? 0
  count += properties.subscriptionIdentifiers?.length ?? 0
  if (properties.contentType !== undefined) count += 1
  return count
}
