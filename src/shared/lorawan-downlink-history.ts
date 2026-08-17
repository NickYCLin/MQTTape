import type { LoRaWanDownlinkProvider } from './lorawan-downlink'

export const DOWNLINK_HISTORY_STORAGE_KEY = 'mqttape:downlink-history:v1'
export const MAX_DOWNLINK_HISTORY_EVENTS = 1_000

export type LoRaWanDownlinkEventKind =
  | 'request'
  | 'queued'
  | 'sent'
  | 'ack'
  | 'nack'
  | 'failed'
  | 'txack'

export type LoRaWanDownlinkStatus =
  | 'requested'
  | 'queued'
  | 'sent'
  | 'acknowledged'
  | 'not-acknowledged'
  | 'failed'

export type LoRaWanDownlinkCorrelationBasis =
  | 'correlation-id'
  | 'queue-item-id'
  | 'device-order'
  | 'none'

export interface LoRaWanDownlinkEvent {
  id: string
  messageId: string
  provider: LoRaWanDownlinkProvider
  kind: LoRaWanDownlinkEventKind
  status: LoRaWanDownlinkStatus
  direction: 'incoming' | 'outgoing'
  observedAt: string
  occurredAt: string
  topic: string
  applicationId: string
  deviceId: string
  devEui?: string
  correlationIds: string[]
  queueItemId?: string
  fPort?: number
  frameCounter?: number
  confirmed?: boolean
  error?: string
}

export interface LoRaWanDownlinkTrack {
  id: string
  provider: LoRaWanDownlinkProvider
  applicationId: string
  deviceId: string
  devEui?: string
  status: LoRaWanDownlinkStatus
  correlationBasis: LoRaWanDownlinkCorrelationBasis
  correlationId?: string
  queueItemId?: string
  firstObservedAt: string
  lastObservedAt: string
  events: LoRaWanDownlinkEvent[]
}

export interface LoRaWanDownlinkHistoryFile {
  format: 'mqttape-downlink-history'
  version: 1
  exportedAt: string
  events: LoRaWanDownlinkEvent[]
}

export interface DownlinkHistoryStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const eventKinds = new Set<LoRaWanDownlinkEventKind>([
  'request',
  'queued',
  'sent',
  'ack',
  'nack',
  'failed',
  'txack'
])
const statuses = new Set<LoRaWanDownlinkStatus>([
  'requested',
  'queued',
  'sent',
  'acknowledged',
  'not-acknowledged',
  'failed'
])

function requiredString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function optionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

export function isLoRaWanDownlinkEvent(value: unknown): value is LoRaWanDownlinkEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<LoRaWanDownlinkEvent>
  return Boolean(
    requiredString(event.id) &&
    requiredString(event.messageId) &&
    (event.provider === 'the-things-stack' || event.provider === 'chirpstack') &&
    eventKinds.has(event.kind as LoRaWanDownlinkEventKind) &&
    statuses.has(event.status as LoRaWanDownlinkStatus) &&
    (event.direction === 'incoming' || event.direction === 'outgoing') &&
    validTimestamp(event.observedAt) &&
    validTimestamp(event.occurredAt) &&
    requiredString(event.topic) &&
    requiredString(event.applicationId) &&
    requiredString(event.deviceId) &&
    optionalString(event.devEui) &&
    Array.isArray(event.correlationIds) &&
    event.correlationIds.every((id) => typeof id === 'string') &&
    optionalString(event.queueItemId) &&
    optionalNumber(event.fPort) &&
    optionalNumber(event.frameCounter) &&
    (event.confirmed === undefined || typeof event.confirmed === 'boolean') &&
    optionalString(event.error)
  )
}

export function mergeLoRaWanDownlinkHistoryEvents(
  existing: LoRaWanDownlinkEvent[],
  observed: LoRaWanDownlinkEvent[],
  limit = MAX_DOWNLINK_HISTORY_EVENTS
): LoRaWanDownlinkEvent[] {
  const eventsById = new Map<string, LoRaWanDownlinkEvent>()
  for (const event of [...existing, ...observed]) {
    if (isLoRaWanDownlinkEvent(event)) eventsById.set(event.id, event)
  }

  const sorted = [...eventsById.values()].sort((left, right) => (
    Date.parse(left.observedAt) - Date.parse(right.observedAt)
  ))
  return sorted.slice(-Math.max(0, limit))
}

export function createLoRaWanDownlinkHistoryFile(
  events: LoRaWanDownlinkEvent[],
  exportedAt = new Date().toISOString()
): LoRaWanDownlinkHistoryFile {
  return {
    format: 'mqttape-downlink-history',
    version: 1,
    exportedAt,
    events: mergeLoRaWanDownlinkHistoryEvents([], events)
  }
}

export function isLoRaWanDownlinkHistoryFile(
  value: unknown
): value is LoRaWanDownlinkHistoryFile {
  if (!value || typeof value !== 'object') return false
  const history = value as Partial<LoRaWanDownlinkHistoryFile>
  return history.format === 'mqttape-downlink-history' &&
    history.version === 1 &&
    validTimestamp(history.exportedAt) &&
    Array.isArray(history.events) &&
    history.events.every(isLoRaWanDownlinkEvent)
}

export function readLoRaWanDownlinkHistory(
  storage: Pick<DownlinkHistoryStorage, 'getItem'>
): LoRaWanDownlinkEvent[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(DOWNLINK_HISTORY_STORAGE_KEY) || 'null')
    if (!isLoRaWanDownlinkHistoryFile(parsed)) return []
    return mergeLoRaWanDownlinkHistoryEvents([], parsed.events)
  } catch {
    return []
  }
}

export function writeLoRaWanDownlinkHistory(
  storage: Pick<DownlinkHistoryStorage, 'setItem'>,
  events: LoRaWanDownlinkEvent[]
): boolean {
  try {
    storage.setItem(
      DOWNLINK_HISTORY_STORAGE_KEY,
      JSON.stringify(createLoRaWanDownlinkHistoryFile(events))
    )
    return true
  } catch {
    return false
  }
}

export function clearLoRaWanDownlinkHistory(
  storage: Pick<DownlinkHistoryStorage, 'removeItem'>
): boolean {
  try {
    storage.removeItem(DOWNLINK_HISTORY_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function canUseLoRaWanDownlinkHistoryStorage(
  storage: Pick<DownlinkHistoryStorage, 'setItem' | 'removeItem'>
): boolean {
  const probeKey = `${DOWNLINK_HISTORY_STORAGE_KEY}:probe`
  try {
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}
