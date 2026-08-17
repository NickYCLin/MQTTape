import type {
  MqttMessageProperties,
  MqttPublishProperties,
  MqttUserProperty,
  MqttVersion
} from './contracts'
import { publishTopicError } from './mqtt-topic'

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

const publishPropertyNames = new Set<keyof MqttPublishProperties>([
  'payloadFormatIndicator',
  'messageExpiryInterval',
  'responseTopic',
  'correlationDataBase64',
  'userProperties',
  'contentType'
])

export function isMqttPublishProperties(value: unknown): value is MqttPublishProperties {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const properties = value as MqttPublishProperties

  if (Object.keys(value).some((name) => !publishPropertyNames.has(name as keyof MqttPublishProperties))) {
    return false
  }
  if (properties.payloadFormatIndicator !== undefined &&
      typeof properties.payloadFormatIndicator !== 'boolean') return false
  if (properties.messageExpiryInterval !== undefined &&
      !isIntegerInRange(properties.messageExpiryInterval, 0, MAXIMUM_MESSAGE_EXPIRY)) return false
  if (properties.responseTopic !== undefined &&
      (typeof properties.responseTopic !== 'string' || publishTopicError(properties.responseTopic))) {
    return false
  }
  if (properties.contentType !== undefined && typeof properties.contentType !== 'string') return false
  if (properties.correlationDataBase64 !== undefined &&
      (typeof properties.correlationDataBase64 !== 'string' ||
       !isCanonicalBase64(properties.correlationDataBase64))) return false
  if (properties.userProperties !== undefined &&
      (!Array.isArray(properties.userProperties) || properties.userProperties.some((property) =>
        !property || typeof property.name !== 'string' || typeof property.value !== 'string'
      ))) return false

  return true
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
  if (properties.responseTopic !== undefined &&
      (typeof properties.responseTopic !== 'string' || publishTopicError(properties.responseTopic))) {
    return false
  }
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

export function countMqttPublishProperties(properties: MqttPublishProperties): number {
  let count = 0
  if (properties.payloadFormatIndicator !== undefined) count += 1
  if (properties.messageExpiryInterval !== undefined) count += 1
  if (properties.responseTopic !== undefined) count += 1
  if (properties.correlationDataBase64 !== undefined) count += 1
  count += properties.userProperties?.length ?? 0
  if (properties.contentType !== undefined) count += 1
  return count
}

export function toMqttPublishProperties(
  properties: MqttMessageProperties | undefined
): MqttPublishProperties | undefined {
  if (!properties) return undefined

  const publishProperties: MqttPublishProperties = {}
  if (properties.payloadFormatIndicator !== undefined) {
    publishProperties.payloadFormatIndicator = properties.payloadFormatIndicator
  }
  if (properties.messageExpiryInterval !== undefined) {
    publishProperties.messageExpiryInterval = properties.messageExpiryInterval
  }
  if (properties.responseTopic !== undefined) {
    publishProperties.responseTopic = properties.responseTopic
  }
  if (properties.correlationDataBase64 !== undefined) {
    publishProperties.correlationDataBase64 = properties.correlationDataBase64
  }
  if (properties.userProperties?.length) {
    publishProperties.userProperties = properties.userProperties.map(({ name, value }) => ({
      name,
      value
    }))
  }
  if (properties.contentType !== undefined) publishProperties.contentType = properties.contentType

  return countMqttPublishProperties(publishProperties) > 0 ? publishProperties : undefined
}

export const MQTT5_PUBLISH_PROPERTIES_VERSION_ERROR =
  'MQTT 5 publish properties require an MQTT 5 connection.'
export const MQTT5_PUBLISH_PROPERTIES_INVALID_ERROR =
  'MQTT 5 publish properties are invalid.'

export function mqttPublishPropertiesProtocolError(
  mqttVersion: MqttVersion,
  properties: MqttPublishProperties | undefined
): string | undefined {
  return properties && countMqttPublishProperties(properties) > 0 && mqttVersion !== 5
    ? MQTT5_PUBLISH_PROPERTIES_VERSION_ERROR
    : undefined
}

function toMqttUserProperties(
  properties: MqttUserProperty[] | undefined
): Record<string, string | string[]> | undefined {
  if (!properties?.length) return undefined

  const result: Record<string, string | string[]> = Object.create(null)
  for (const { name, value } of properties) {
    const current = result[name]
    if (current === undefined) result[name] = value
    else if (Array.isArray(current)) current.push(value)
    else result[name] = [current, value]
  }
  return result
}

export interface MqttPublishPacketProperties<Binary extends Uint8Array> {
  payloadFormatIndicator?: boolean
  messageExpiryInterval?: number
  responseTopic?: string
  correlationData?: Binary
  userProperties?: Record<string, string | string[]>
  contentType?: string
}

export function toMqttPublishPacketProperties<Binary extends Uint8Array>(
  value: MqttPublishProperties | undefined,
  decodeBase64: (base64: string) => Binary
): MqttPublishPacketProperties<Binary> | undefined {
  if (value === undefined) return undefined
  if (!isMqttPublishProperties(value)) throw new Error(MQTT5_PUBLISH_PROPERTIES_INVALID_ERROR)

  const properties: MqttPublishPacketProperties<Binary> = {}
  if (value.payloadFormatIndicator !== undefined) {
    properties.payloadFormatIndicator = value.payloadFormatIndicator
  }
  if (value.messageExpiryInterval !== undefined) {
    properties.messageExpiryInterval = value.messageExpiryInterval
  }
  if (value.responseTopic !== undefined) properties.responseTopic = value.responseTopic
  if (value.correlationDataBase64 !== undefined) {
    try {
      properties.correlationData = decodeBase64(value.correlationDataBase64)
    } catch {
      throw new Error(MQTT5_PUBLISH_PROPERTIES_INVALID_ERROR)
    }
  }
  const userProperties = toMqttUserProperties(value.userProperties)
  if (userProperties) properties.userProperties = userProperties
  if (value.contentType !== undefined) properties.contentType = value.contentType

  return countMqttPublishProperties(value) > 0 ? properties : undefined
}
