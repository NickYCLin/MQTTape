import { decodePayloadBytes } from './message'

export type LoRaWanDownlinkProvider = 'the-things-stack' | 'chirpstack'
export type LoRaWanDownlinkPayloadFormat = 'text' | 'hex' | 'base64' | 'json'
export type TheThingsStackDownlinkOperation = 'push' | 'replace'
export type TheThingsStackDownlinkPriority =
  | 'LOWEST'
  | 'LOW'
  | 'BELOW_NORMAL'
  | 'NORMAL'
  | 'ABOVE_NORMAL'
  | 'HIGH'
  | 'HIGHEST'

export interface LoRaWanDownlinkInput {
  provider: LoRaWanDownlinkProvider
  applicationId: string
  deviceId: string
  tenantId?: string
  fPort: number
  confirmed: boolean
  payloadFormat: LoRaWanDownlinkPayloadFormat
  payload: string
  operation?: TheThingsStackDownlinkOperation
  priority?: TheThingsStackDownlinkPriority
  correlationId?: string
}

export type LoRaWanDownlinkError =
  | 'application-id-required'
  | 'application-id-invalid'
  | 'device-id-required'
  | 'device-id-invalid'
  | 'tenant-id-invalid'
  | 'dev-eui-invalid'
  | 'f-port-invalid'
  | 'payload-required'
  | 'hex-invalid'
  | 'base64-invalid'
  | 'json-invalid'

export interface LoRaWanMqttPublication {
  topic: string
  payload: string
  framePayloadBase64?: string
  framePayloadBytes?: number
}

export type LoRaWanDownlinkBuildResult =
  | { ok: true; publication: LoRaWanMqttPublication }
  | { ok: false; error: LoRaWanDownlinkError }

export function createLoRaWanCorrelationId(): string {
  const identifier = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `mqttape:${identifier}`
}

function validTopicSegment(value: string): boolean {
  return value.length > 0 && !/[\s/+#\0]/.test(value)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function encodeFramePayload(
  format: Exclude<LoRaWanDownlinkPayloadFormat, 'json'>,
  payload: string
): { base64: string; bytes: number } | LoRaWanDownlinkError {
  if (format === 'text') {
    const bytes = new TextEncoder().encode(payload)
    return { base64: bytesToBase64(bytes), bytes: bytes.byteLength }
  }

  if (format === 'hex') {
    const normalized = payload.replace(/[\s:-]/g, '')
    if (!normalized || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(normalized)) {
      return 'hex-invalid'
    }
    const bytes = Uint8Array.from(
      normalized.match(/.{2}/g) ?? [],
      (pair) => Number.parseInt(pair, 16)
    )
    return { base64: bytesToBase64(bytes), bytes: bytes.byteLength }
  }

  const normalized = payload.trim()
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
    return 'base64-invalid'
  }
  try {
    const bytes = decodePayloadBytes(normalized)
    return { base64: bytesToBase64(bytes), bytes: bytes.byteLength }
  } catch {
    return 'base64-invalid'
  }
}

function parseDecodedPayload(payload: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(payload)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}

export function buildLoRaWanDownlink(
  input: LoRaWanDownlinkInput
): LoRaWanDownlinkBuildResult {
  const applicationId = input.applicationId.trim()
  const deviceId = input.deviceId.trim()
  const tenantId = input.tenantId?.trim() ?? ''

  if (!applicationId) return { ok: false, error: 'application-id-required' }
  if (!validTopicSegment(applicationId)) return { ok: false, error: 'application-id-invalid' }
  if (!deviceId) return { ok: false, error: 'device-id-required' }
  if (!validTopicSegment(deviceId)) return { ok: false, error: 'device-id-invalid' }
  if (input.provider === 'the-things-stack' && tenantId && !validTopicSegment(tenantId)) {
    return { ok: false, error: 'tenant-id-invalid' }
  }
  if (input.provider === 'chirpstack' && !/^[0-9a-f]{16}$/i.test(deviceId)) {
    return { ok: false, error: 'dev-eui-invalid' }
  }

  const maximumFPort = input.provider === 'the-things-stack' ? 233 : 255
  if (!Number.isInteger(input.fPort) || input.fPort < 1 || input.fPort > maximumFPort) {
    return { ok: false, error: 'f-port-invalid' }
  }
  const payloadIsEmpty = input.payloadFormat === 'text'
    ? input.payload.length === 0
    : !input.payload.trim()
  if (payloadIsEmpty) return { ok: false, error: 'payload-required' }

  const decodedPayload = input.payloadFormat === 'json'
    ? parseDecodedPayload(input.payload)
    : undefined
  if (input.payloadFormat === 'json' && decodedPayload === undefined) {
    return { ok: false, error: 'json-invalid' }
  }

  const encoded = input.payloadFormat === 'json'
    ? undefined
    : encodeFramePayload(input.payloadFormat, input.payload)
  if (typeof encoded === 'string') return { ok: false, error: encoded }

  if (input.provider === 'the-things-stack') {
    const application = tenantId ? `${applicationId}@${tenantId}` : applicationId
    const operation = input.operation ?? 'push'
    const downlink = {
      f_port: input.fPort,
      ...(decodedPayload === undefined
        ? { frm_payload: encoded?.base64 ?? '' }
        : { decoded_payload: decodedPayload }),
      priority: input.priority ?? 'NORMAL',
      confirmed: input.confirmed,
      ...(input.correlationId?.trim()
        ? { correlation_ids: [input.correlationId.trim()] }
        : {})
    }
    return {
      ok: true,
      publication: {
        topic: `v3/${application}/devices/${deviceId}/down/${operation}`,
        payload: JSON.stringify({ downlinks: [downlink] }, null, 2),
        framePayloadBase64: encoded?.base64,
        framePayloadBytes: encoded?.bytes
      }
    }
  }

  const devEui = deviceId.toLowerCase()
  const downlink = {
    devEui,
    confirmed: input.confirmed,
    fPort: input.fPort,
    ...(decodedPayload === undefined
      ? { data: encoded?.base64 ?? '' }
      : { object: decodedPayload })
  }
  return {
    ok: true,
    publication: {
      topic: `application/${applicationId}/device/${devEui}/command/down`,
      payload: JSON.stringify(downlink, null, 2),
      framePayloadBase64: encoded?.base64,
      framePayloadBytes: encoded?.bytes
    }
  }
}
