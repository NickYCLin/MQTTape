import type { CaptureFile } from './contracts'

export function isCaptureFile(value: unknown): value is CaptureFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CaptureFile>
  if (candidate.format !== 'mqttape-capture' || candidate.version !== 1) return false
  if (!Array.isArray(candidate.messages) || !candidate.connection) return false

  return candidate.messages.every((message) => {
    const timestamp = Date.parse(message?.timestamp ?? '')
    return Boolean(
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
  })
}
