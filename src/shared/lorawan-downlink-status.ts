import type { MqttMessageRecord } from './contracts'
import type { LoRaWanDownlinkProvider } from './lorawan-downlink'

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
  direction: MqttMessageRecord['direction']
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

type JsonRecord = Record<string, unknown>

const ttsTopic = /^v3\/([^/]+)\/devices\/([^/]+)\/down\/(push|replace|queued|sent|ack|nack|failed)$/
const chirpStackTopic = /^application\/([^/]+)\/device\/([^/]+)\/(command\/down|event\/(ack|txack))$/

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const string = asString(item)
    return string ? [string] : []
  })
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function parsePayload(message: MqttMessageRecord): JsonRecord | undefined {
  try {
    return asRecord(JSON.parse(message.payloadText))
  } catch {
    return undefined
  }
}

function validTimestamp(value: unknown, fallback: string): string {
  const timestamp = asString(value)
  return timestamp && Number.isFinite(Date.parse(timestamp)) ? timestamp : fallback
}

function errorSummary(value: unknown): string | undefined {
  const direct = asString(value)
  if (direct) return direct

  const error = asRecord(value)
  if (!error) return undefined
  const parts = [error.message, error.description, error.name, error.code]
    .map(asString)
    .filter((part): part is string => Boolean(part))
  return unique(parts).join(' · ') || errorSummary(error.cause)
}

function ttsStatus(kind: Exclude<LoRaWanDownlinkEventKind, 'request' | 'txack'>): LoRaWanDownlinkStatus {
  if (kind === 'ack') return 'acknowledged'
  if (kind === 'nack') return 'not-acknowledged'
  return kind
}

function parseTtsEvents(
  message: MqttMessageRecord,
  match: RegExpMatchArray,
  payload: JsonRecord
): LoRaWanDownlinkEvent[] {
  const [, applicationId, deviceId, topicEvent] = match
  if ((topicEvent === 'push' || topicEvent === 'replace') && message.direction === 'outgoing') {
    const downlinks = Array.isArray(payload.downlinks) ? payload.downlinks : []
    return downlinks.flatMap((item, index) => {
      const downlink = asRecord(item)
      if (!downlink) return []
      return [{
        id: `${message.id}:${index}`,
        messageId: message.id,
        provider: 'the-things-stack' as const,
        kind: 'request' as const,
        status: 'requested' as const,
        direction: message.direction,
        observedAt: message.timestamp,
        occurredAt: message.timestamp,
        topic: message.topic,
        applicationId,
        deviceId,
        correlationIds: asStringArray(downlink.correlation_ids),
        fPort: asNumber(downlink.f_port),
        frameCounter: asNumber(downlink.f_cnt),
        confirmed: asBoolean(downlink.confirmed)
      }]
    })
  }

  if (message.direction !== 'incoming' || topicEvent === 'push' || topicEvent === 'replace') {
    return []
  }

  const kind = topicEvent as Exclude<LoRaWanDownlinkEventKind, 'request' | 'txack'>
  const detail = asRecord(payload[`downlink_${kind === 'nack' ? 'nack' : kind}`]) ?? {}
  const identifiers = asRecord(payload.end_device_ids)
  return [{
    id: message.id,
    messageId: message.id,
    provider: 'the-things-stack',
    kind,
    status: ttsStatus(kind),
    direction: message.direction,
    observedAt: message.timestamp,
    occurredAt: validTimestamp(payload.received_at, message.timestamp),
    topic: message.topic,
    applicationId,
    deviceId: asString(identifiers?.device_id) ?? deviceId,
    devEui: asString(identifiers?.dev_eui),
    correlationIds: unique([
      ...asStringArray(payload.correlation_ids),
      ...asStringArray(detail.correlation_ids)
    ]),
    fPort: asNumber(detail.f_port),
    frameCounter: asNumber(detail.f_cnt),
    confirmed: asBoolean(detail.confirmed),
    error: kind === 'failed' ? errorSummary(detail.error) : undefined
  }]
}

function parseChirpStackEvent(
  message: MqttMessageRecord,
  match: RegExpMatchArray,
  payload: JsonRecord
): LoRaWanDownlinkEvent[] {
  const [, applicationId, topicDevEui, route, eventName] = match
  const deviceInfo = asRecord(payload.deviceInfo)
  const devEui = (asString(deviceInfo?.devEui) ?? asString(payload.devEui) ?? topicDevEui).toLowerCase()

  if (route === 'command/down' && message.direction === 'outgoing') {
    return [{
      id: message.id,
      messageId: message.id,
      provider: 'chirpstack',
      kind: 'request',
      status: 'requested',
      direction: message.direction,
      observedAt: message.timestamp,
      occurredAt: message.timestamp,
      topic: message.topic,
      applicationId,
      deviceId: asString(deviceInfo?.deviceName) ?? devEui,
      devEui,
      correlationIds: [],
      fPort: asNumber(payload.fPort),
      confirmed: asBoolean(payload.confirmed)
    }]
  }

  if (message.direction !== 'incoming' || (eventName !== 'ack' && eventName !== 'txack')) {
    return []
  }

  const acknowledged = asBoolean(payload.acknowledged) ?? false
  const kind = eventName
  return [{
    id: message.id,
    messageId: message.id,
    provider: 'chirpstack',
    kind,
    status: kind === 'txack' ? 'sent' : acknowledged ? 'acknowledged' : 'not-acknowledged',
    direction: message.direction,
    observedAt: message.timestamp,
    occurredAt: validTimestamp(payload.time, message.timestamp),
    topic: message.topic,
    applicationId: asString(deviceInfo?.applicationId) ?? applicationId,
    deviceId: asString(deviceInfo?.deviceName) ?? devEui,
    devEui,
    correlationIds: [],
    queueItemId: asString(payload.queueItemId),
    frameCounter: asNumber(payload.fCntDown)
  }]
}

export function inspectLoRaWanDownlinkEvents(
  message: MqttMessageRecord
): LoRaWanDownlinkEvent[] {
  const payload = parsePayload(message)
  if (!payload) return []

  const ttsMatch = message.topic.match(ttsTopic)
  if (ttsMatch) return parseTtsEvents(message, ttsMatch, payload)

  const chirpStackMatch = message.topic.match(chirpStackTopic)
  if (chirpStackMatch) return parseChirpStackEvent(message, chirpStackMatch, payload)

  return []
}

function eventTime(event: LoRaWanDownlinkEvent): number {
  const occurred = Date.parse(event.occurredAt)
  if (Number.isFinite(occurred)) return occurred
  const observed = Date.parse(event.observedAt)
  return Number.isFinite(observed) ? observed : 0
}

function observedEventTime(event: LoRaWanDownlinkEvent): number {
  const observed = Date.parse(event.observedAt)
  return Number.isFinite(observed) ? observed : 0
}

function compareEvents(
  left: LoRaWanDownlinkEvent,
  right: LoRaWanDownlinkEvent
): number {
  if (left.kind === 'request' && right.kind !== 'request') return -1
  if (right.kind === 'request' && left.kind !== 'request') return 1
  return eventTime(left) - eventTime(right)
}

function sameDevice(track: LoRaWanDownlinkTrack, event: LoRaWanDownlinkEvent): boolean {
  if (track.provider !== event.provider || track.applicationId !== event.applicationId) return false
  if (track.devEui && event.devEui) return track.devEui.toLowerCase() === event.devEui.toLowerCase()
  return track.deviceId === event.deviceId
}

function hasTerminalEvent(track: LoRaWanDownlinkTrack): boolean {
  return track.events.some(({ status }) => (
    status === 'acknowledged' || status === 'not-acknowledged' || status === 'failed'
  ))
}

function createTrack(
  event: LoRaWanDownlinkEvent,
  basis: LoRaWanDownlinkCorrelationBasis
): LoRaWanDownlinkTrack {
  return {
    id: event.correlationIds[0] ?? event.queueItemId ?? event.id,
    provider: event.provider,
    applicationId: event.applicationId,
    deviceId: event.deviceId,
    devEui: event.devEui,
    status: event.status,
    correlationBasis: basis,
    correlationId: event.correlationIds[0],
    queueItemId: event.queueItemId,
    firstObservedAt: event.observedAt,
    lastObservedAt: event.observedAt,
    events: [event]
  }
}

function appendEvent(
  track: LoRaWanDownlinkTrack,
  event: LoRaWanDownlinkEvent,
  basis: LoRaWanDownlinkCorrelationBasis
): void {
  track.events.push(event)
  track.events.sort(compareEvents)
  track.status = track.events.at(-1)?.status ?? event.status
  track.lastObservedAt = track.events.at(-1)?.observedAt ?? event.observedAt
  track.firstObservedAt = track.events[0]?.observedAt ?? event.observedAt
  track.devEui ??= event.devEui
  if (track.devEui && track.deviceId.toLowerCase() === track.devEui.toLowerCase()
    && event.deviceId !== event.devEui) {
    track.deviceId = event.deviceId
  }
  track.correlationId ??= event.correlationIds[0]
  track.queueItemId ??= event.queueItemId
  if (basis !== 'none' && track.correlationBasis !== 'device-order') {
    track.correlationBasis = basis
  }
}

function exactTrack(
  tracks: LoRaWanDownlinkTrack[],
  event: LoRaWanDownlinkEvent
): { track: LoRaWanDownlinkTrack; basis: LoRaWanDownlinkCorrelationBasis } | undefined {
  if (event.queueItemId) {
    const track = [...tracks].reverse().find((candidate) => (
      sameDevice(candidate, event) && candidate.queueItemId === event.queueItemId
    ))
    if (track) return { track, basis: 'queue-item-id' }
  }
  if (event.correlationIds.length > 0) {
    const track = [...tracks].reverse().find((candidate) => (
      sameDevice(candidate, event) && candidate.events.some((candidateEvent) =>
        candidateEvent.correlationIds.some((id) => event.correlationIds.includes(id))
      )
    ))
    if (track) return { track, basis: 'correlation-id' }
  }
  return undefined
}

function inferredChirpStackTrack(
  tracks: LoRaWanDownlinkTrack[],
  event: LoRaWanDownlinkEvent
): LoRaWanDownlinkTrack | undefined {
  if (event.provider !== 'chirpstack' || event.kind !== 'txack') return undefined
  return tracks
    .filter((track) => sameDevice(track, event)
      && !track.queueItemId
      && !hasTerminalEvent(track)
      && eventTime(track.events[0]) <= eventTime(event))
    .sort((left, right) => Date.parse(right.lastObservedAt) - Date.parse(left.lastObservedAt))[0]
}

export function buildLoRaWanDownlinkTracks(
  messages: MqttMessageRecord[]
): LoRaWanDownlinkTrack[] {
  const events = messages
    .flatMap(inspectLoRaWanDownlinkEvents)
    .sort((left, right) => observedEventTime(left) - observedEventTime(right))
  const tracks: LoRaWanDownlinkTrack[] = []

  for (const event of events) {
    if (event.kind === 'request') {
      const basis = event.correlationIds.length > 0 ? 'correlation-id' : 'none'
      tracks.push(createTrack(event, basis))
      continue
    }

    const exact = exactTrack(tracks, event)
    if (exact) {
      appendEvent(exact.track, event, exact.basis)
      continue
    }

    const inferred = inferredChirpStackTrack(tracks, event)
    if (inferred) {
      appendEvent(inferred, event, 'device-order')
      continue
    }

    const basis = event.queueItemId
      ? 'queue-item-id'
      : event.correlationIds.length > 0
        ? 'correlation-id'
        : 'none'
    tracks.push(createTrack(event, basis))
  }

  return tracks.sort((left, right) => Date.parse(right.lastObservedAt) - Date.parse(left.lastObservedAt))
}
