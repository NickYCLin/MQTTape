import { useState } from 'react'
import type { MqttMessageRecord } from '../../../shared/contracts'
import {
  decodePayload,
  decodePayloadBytes,
  detectPayloadKind,
  formatHexDump,
  prettyPayload,
  type PayloadKind
} from '../../../shared/message'
import { DownloadIcon } from './icons'

type PayloadViewMode = 'text' | 'json' | 'hex'
const MAX_PREVIEW_BYTES = 256 * 1024

interface PayloadInspectorProps {
  message: MqttMessageRecord
}

function initialMode(kind: PayloadKind): PayloadViewMode {
  if (kind === 'json') return 'json'
  if (kind === 'binary') return 'hex'
  return 'text'
}

function payloadFilename(message: MqttMessageRecord, kind: PayloadKind): string {
  const topic = message.topic
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'payload'
  const extension = kind === 'json' ? 'json' : kind === 'text' ? 'txt' : 'bin'
  return `${topic}-${message.timestamp.replace(/[:.]/g, '-')}.${extension}`
}

export function PayloadInspector({ message }: PayloadInspectorProps) {
  const kind = detectPayloadKind(message.payloadBase64)
  const [mode, setMode] = useState<PayloadViewMode>(() => initialMode(kind))
  const payloadBytes = decodePayloadBytes(message.payloadBase64)
  const previewTruncated = payloadBytes.byteLength > MAX_PREVIEW_BYTES
  const decodedText = previewTruncated
    ? new TextDecoder().decode(payloadBytes.subarray(0, MAX_PREVIEW_BYTES))
    : decodePayload(message.payloadBase64)
  const content = mode === 'hex'
    ? formatHexDump(message.payloadBase64, 16, MAX_PREVIEW_BYTES)
    : mode === 'json'
      ? prettyPayload(decodedText)
      : decodedText

  const download = (): void => {
    const bytes = decodePayloadBytes(message.payloadBase64)
    const contents = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(contents).set(bytes)
    const blob = new Blob([contents], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = payloadFilename(message, kind)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="payload-inspector">
      <div className="payload-inspector-toolbar">
        <div className="payload-view-tabs" role="tablist" aria-label="Payload view">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'text'}
            className={mode === 'text' ? 'active' : ''}
            onClick={() => setMode('text')}
          >
            Text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'json'}
            className={mode === 'json' ? 'active' : ''}
            disabled={kind !== 'json'}
            title={kind === 'json' ? 'Formatted JSON' : 'Payload is not valid JSON'}
            onClick={() => setMode('json')}
          >
            JSON
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'hex'}
            className={mode === 'hex' ? 'active' : ''}
            onClick={() => setMode('hex')}
          >
            Hex
          </button>
        </div>
        <div className="payload-inspector-actions">
          <span className={`payload-kind ${kind}`}>{kind}</span>
          <button type="button" onClick={download}>
            <DownloadIcon width={14} height={14} />
            Raw
          </button>
        </div>
      </div>
      {kind === 'binary' && mode === 'text' && (
        <p className="payload-inspector-note">
          This payload is not valid printable UTF-8; replacement characters may appear below.
        </p>
      )}
      {previewTruncated && mode !== 'hex' && (
        <p className="payload-inspector-note">
          Preview limited to the first 256 KB. Raw downloads the complete payload.
        </p>
      )}
      <pre className={mode === 'hex' ? 'hex-dump' : ''} role="tabpanel">
        {content || '(empty payload)'}
      </pre>
    </div>
  )
}
