import type { MqttMessageRecord } from './contracts'

export function createMessageId(timestamp = Date.now()): string {
  const random = Math.random().toString(36).slice(2, 9)
  return `${timestamp.toString(36)}-${random}`
}

export function decodePayload(base64: string): string {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function prettyPayload(payloadText: string): string {
  const trimmed = payloadText.trim()
  if (!trimmed) return ''

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return payloadText
  }
}

export function filterMessages(
  messages: MqttMessageRecord[],
  query: string
): MqttMessageRecord[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return messages

  return messages.filter((message) =>
    `${message.topic}\n${message.payloadText}`.toLocaleLowerCase().includes(normalized)
  )
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
