import type { CaptureFile, MqttMessageRecord } from './contracts'
import { decodePayloadBytes, filterMessages } from './message'

export interface CaptureTrimOptions {
  includeIncoming: boolean
  includeOutgoing: boolean
  query: string
  fromTimestamp?: string
  toTimestamp?: string
}

export interface CaptureTrimPlan {
  messages: MqttMessageRecord[]
  error?: string
}

function captureBoundary(value: string | undefined, label: string): { time?: number; error?: string } {
  if (!value) return {}
  const time = Date.parse(value)
  return Number.isFinite(time)
    ? { time }
    : { error: `${label} is not a valid date and time.` }
}

export function createCaptureTrimPlan(
  messages: MqttMessageRecord[],
  options: CaptureTrimOptions
): CaptureTrimPlan {
  const from = captureBoundary(options.fromTimestamp, 'Start time')
  if (from.error) return { messages: [], error: from.error }
  const to = captureBoundary(options.toTimestamp, 'End time')
  if (to.error) return { messages: [], error: to.error }
  if (from.time !== undefined && to.time !== undefined && from.time > to.time) {
    return { messages: [], error: 'Start time must be before or equal to end time.' }
  }

  const selected = messages.filter((message) => {
    if (message.direction === 'incoming' && !options.includeIncoming) return false
    if (message.direction === 'outgoing' && !options.includeOutgoing) return false
    const timestamp = Date.parse(message.timestamp)
    if (from.time !== undefined && timestamp < from.time) return false
    if (to.time !== undefined && timestamp > to.time) return false
    return true
  })

  return { messages: filterMessages(selected, options.query) }
}

export function isCaptureFile(value: unknown): value is CaptureFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CaptureFile>
  if (candidate.format !== 'mqttape-capture' || candidate.version !== 1) return false
  if (!Array.isArray(candidate.messages) || !candidate.connection) return false

  return candidate.messages.every((message) => {
    const timestamp = Date.parse(message?.timestamp ?? '')
    const validShape = Boolean(
      message &&
      typeof message.id === 'string' &&
      (message.direction === 'incoming' || message.direction === 'outgoing') &&
      typeof message.topic === 'string' &&
      message.topic.length > 0 &&
      Number.isFinite(timestamp) &&
      (message.qos === 0 || message.qos === 1 || message.qos === 2) &&
      typeof message.retain === 'boolean' &&
      typeof message.duplicate === 'boolean' &&
      typeof message.payloadBase64 === 'string' &&
      typeof message.payloadText === 'string' &&
      typeof message.size === 'number' &&
      message.size >= 0
    )
    if (!validShape) return false

    try {
      return decodePayloadBytes(message.payloadBase64).byteLength === message.size
    } catch {
      return false
    }
  })
}
