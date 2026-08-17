import { decodePayloadBytes } from './message'

type JsonObject = Record<string, unknown>

export type LoRaWanProvider = 'the-things-stack' | 'chirpstack'

export interface LoRaWanGatewayReception {
  gatewayId?: string
  gatewayEui?: string
  rssi?: number
  snr?: number
}

export interface LoRaWanUplinkInspection {
  provider: LoRaWanProvider
  deviceId?: string
  deviceName?: string
  devEui?: string
  applicationId?: string
  applicationName?: string
  receivedAt?: string
  fPort?: number
  frameCounter?: number
  confirmed?: boolean
  frequencyHz?: number
  bandwidthHz?: number
  spreadingFactor?: number
  dataRateIndex?: number
  framePayloadBase64?: string
  decodedPayload?: unknown
  gateways: LoRaWanGatewayReception[]
}

function asObject(value: unknown): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function asBase64(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized === '') return ''
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
    return undefined
  }

  try {
    decodePayloadBytes(normalized)
    return normalized
  } catch {
    return undefined
  }
}

function property(object: JsonObject, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined
}

function parseGateways(
  value: unknown,
  parser: (gateway: JsonObject) => LoRaWanGatewayReception
): LoRaWanGatewayReception[] {
  if (!Array.isArray(value)) return []
  return value
    .map(asObject)
    .filter((gateway): gateway is JsonObject => gateway !== undefined)
    .map(parser)
}

function inspectTheThingsStack(root: JsonObject): LoRaWanUplinkInspection | null {
  const uplink = asObject(root.uplink_message)
  if (!uplink) return null

  const identifiers = asObject(root.end_device_ids)
  const applicationIds = asObject(identifiers?.application_ids)
  const settings = asObject(uplink.settings)
  const dataRate = asObject(settings?.data_rate)
  const lora = asObject(dataRate?.lora)
  const framePayloadBase64 = asBase64(uplink.frm_payload)
  const hasDecodedPayload = Object.prototype.hasOwnProperty.call(uplink, 'decoded_payload')

  if (framePayloadBase64 === undefined && !hasDecodedPayload) return null

  return {
    provider: 'the-things-stack',
    deviceId: asString(identifiers?.device_id),
    devEui: asString(identifiers?.dev_eui),
    applicationId: asString(applicationIds?.application_id),
    receivedAt: asString(root.received_at) ?? asString(uplink.received_at),
    fPort: asNumber(uplink.f_port),
    frameCounter: asNumber(uplink.f_cnt),
    confirmed: asBoolean(uplink.confirmed),
    frequencyHz: asNumber(settings?.frequency),
    bandwidthHz: asNumber(lora?.bandwidth),
    spreadingFactor: asNumber(lora?.spreading_factor),
    framePayloadBase64,
    decodedPayload: hasDecodedPayload ? property(uplink, 'decoded_payload') : undefined,
    gateways: parseGateways(uplink.rx_metadata, (gateway) => {
      const gatewayIds = asObject(gateway.gateway_ids)
      return {
        gatewayId: asString(gatewayIds?.gateway_id),
        gatewayEui: asString(gatewayIds?.eui),
        rssi: asNumber(gateway.rssi) ?? asNumber(gateway.channel_rssi),
        snr: asNumber(gateway.snr)
      }
    })
  }
}

function inspectChirpStack(root: JsonObject): LoRaWanUplinkInspection | null {
  const deviceInfo = asObject(root.deviceInfo)
  if (!deviceInfo || !asString(deviceInfo.devEui)) return null

  const framePayloadBase64 = asBase64(root.data)
  const hasDecodedPayload = Object.prototype.hasOwnProperty.call(root, 'object')
  if (framePayloadBase64 === undefined && !hasDecodedPayload) return null

  const txInfo = asObject(root.txInfo)
  const modulation = asObject(txInfo?.modulation)
  const lora = asObject(modulation?.lora)

  return {
    provider: 'chirpstack',
    deviceName: asString(deviceInfo.deviceName),
    devEui: asString(deviceInfo.devEui),
    applicationId: asString(deviceInfo.applicationId),
    applicationName: asString(deviceInfo.applicationName),
    receivedAt: asString(root.time),
    fPort: asNumber(root.fPort),
    frameCounter: asNumber(root.fCnt),
    confirmed: asBoolean(root.confirmed),
    frequencyHz: asNumber(txInfo?.frequency),
    bandwidthHz: asNumber(lora?.bandwidth),
    spreadingFactor: asNumber(lora?.spreadingFactor),
    dataRateIndex: asNumber(root.dr),
    framePayloadBase64,
    decodedPayload: hasDecodedPayload ? property(root, 'object') : undefined,
    gateways: parseGateways(root.rxInfo, (gateway) => ({
      gatewayId: asString(gateway.gatewayId),
      rssi: asNumber(gateway.rssi),
      snr: asNumber(gateway.snr)
    }))
  }
}

export function inspectLoRaWanUplink(payloadText: string): LoRaWanUplinkInspection | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(payloadText)
  } catch {
    return null
  }

  const root = asObject(parsed)
  if (!root) return null

  return inspectTheThingsStack(root) ?? inspectChirpStack(root)
}
