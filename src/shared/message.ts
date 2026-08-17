import type { MqttMessageRecord } from './contracts'

export type PayloadKind = 'empty' | 'json' | 'text' | 'binary'

export function createMessageId(timestamp = Date.now()): string {
  const random = Math.random().toString(36).slice(2, 9)
  return `${timestamp.toString(36)}-${random}`
}

export function decodePayload(base64: string): string {
  return new TextDecoder().decode(decodePayloadBytes(base64))
}

export function decodePayloadBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function containsBinaryControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) {
      return true
    }
  }
  return false
}

export function isProbablyBinaryText(value: string): boolean {
  return value.includes('\uFFFD') || containsBinaryControlCharacters(value)
}

export function detectPayloadKind(base64: string): PayloadKind {
  const bytes = decodePayloadBytes(base64)
  if (bytes.byteLength === 0) return 'empty'

  let decoded: string
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return 'binary'
  }
  if (containsBinaryControlCharacters(decoded)) return 'binary'

  const trimmed = decoded.trim()
  if (trimmed) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // Valid UTF-8 that is not JSON remains plain text.
    }
  }
  return 'text'
}

export function formatHexDump(
  base64: string,
  bytesPerRow = 16,
  maxBytes = Number.POSITIVE_INFINITY,
  formatOverflow = (count: number): string => `… ${count} additional byte(s) not shown`
): string {
  const bytes = decodePayloadBytes(base64)
  if (bytes.byteLength === 0) return ''

  const rowSize = Number.isInteger(bytesPerRow) && bytesPerRow > 0 ? bytesPerRow : 16
  const limit = Number.isFinite(maxBytes) && maxBytes >= 0
    ? Math.min(bytes.byteLength, Math.floor(maxBytes))
    : bytes.byteLength
  const visibleBytes = bytes.subarray(0, limit)
  const offsetWidth = Math.max(4, (Math.max(visibleBytes.byteLength, 1) - 1).toString(16).length)
  const hexWidth = rowSize * 3 - 1
  const rows: string[] = []

  for (let offset = 0; offset < visibleBytes.byteLength; offset += rowSize) {
    const row = visibleBytes.subarray(offset, offset + rowSize)
    const hexadecimal = [...row]
      .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
      .join(' ')
      .padEnd(hexWidth)
    const ascii = [...row]
      .map((byte) => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')
      .join('')
      .padEnd(rowSize)
    rows.push(`${offset.toString(16).padStart(offsetWidth, '0').toUpperCase()}  ${hexadecimal}  |${ascii}|`)
  }

  if (visibleBytes.byteLength < bytes.byteLength) {
    rows.push(formatOverflow(bytes.byteLength - visibleBytes.byteLength))
  }

  return rows.join('\n')
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
