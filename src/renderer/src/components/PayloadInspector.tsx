import { useMemo, useState } from 'react'
import type { MqttMessageRecord } from '../../../shared/contracts'
import {
  inspectLoRaWanUplink,
  type LoRaWanUplinkInspection
} from '../../../shared/lorawan'
import {
  decodePayload,
  decodePayloadBytes,
  detectPayloadKind,
  formatHexDump,
  prettyPayload,
  type PayloadKind
} from '../../../shared/message'
import { DownloadIcon } from './icons'
import { useI18n } from '../i18n'

type PayloadViewMode = 'lorawan' | 'text' | 'json' | 'hex'
const MAX_PREVIEW_BYTES = 256 * 1024

interface PayloadInspectorProps {
  message: MqttMessageRecord
}

function initialMode(kind: PayloadKind, hasLoRaWanInspection: boolean): PayloadViewMode {
  if (hasLoRaWanInspection) return 'lorawan'
  if (kind === 'json') return 'json'
  if (kind === 'binary') return 'hex'
  return 'text'
}

function filenameStem(value: string): string {
  return value
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'payload'
}

function payloadFilename(message: MqttMessageRecord, kind: PayloadKind): string {
  const topic = filenameStem(message.topic)
  const extension = kind === 'json' ? 'json' : kind === 'text' ? 'txt' : 'bin'
  return `${topic}-${message.timestamp.replace(/[:.]/g, '-')}.${extension}`
}

function frameFilename(
  message: MqttMessageRecord,
  inspection: LoRaWanUplinkInspection,
  kind: PayloadKind
): string {
  const device = filenameStem(
    inspection.deviceName ?? inspection.deviceId ?? inspection.devEui ?? 'lorawan-frame'
  )
  const extension = kind === 'json' ? 'json' : kind === 'text' ? 'txt' : 'bin'
  return `${device}-${message.timestamp.replace(/[:.]/g, '-')}.${extension}`
}

function downloadBase64(base64: string, filename: string): void {
  const bytes = decodePayloadBytes(base64)
  const contents = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(contents).set(bytes)
  const blob = new Blob([contents], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function namedIdentifier(name?: string, id?: string): string | undefined {
  if (name && id && name !== id) return `${name} (${id})`
  return name ?? id
}

function formatFrequency(frequencyHz: number): string {
  if (frequencyHz >= 1_000_000) {
    return `${Number((frequencyHz / 1_000_000).toFixed(6))} MHz`
  }
  if (frequencyHz >= 1_000) return `${Number((frequencyHz / 1_000).toFixed(3))} kHz`
  return `${frequencyHz} Hz`
}

function formatDataRate(inspection: LoRaWanUplinkInspection): string | undefined {
  const parts: string[] = []
  if (inspection.dataRateIndex !== undefined) parts.push(`DR${inspection.dataRateIndex}`)
  if (inspection.spreadingFactor !== undefined) parts.push(`SF${inspection.spreadingFactor}`)
  if (inspection.bandwidthHz !== undefined) {
    parts.push(inspection.bandwidthHz >= 1_000
      ? `${inspection.bandwidthHz / 1_000} kHz`
      : `${inspection.bandwidthHz} Hz`)
  }
  return parts.length ? parts.join(' · ') : undefined
}

function LoRaWanInspector({
  message,
  inspection
}: {
  message: MqttMessageRecord
  inspection: LoRaWanUplinkInspection
}) {
  const { t, formatNumber, formatDateTime } = useI18n()
  const frameBase64 = inspection.framePayloadBase64
  const frameKind = frameBase64 === undefined ? undefined : detectPayloadKind(frameBase64)
  const frameContent = frameBase64 === undefined
    ? ''
    : frameKind === 'binary'
      ? formatHexDump(frameBase64)
      : frameKind === 'json'
        ? prettyPayload(decodePayload(frameBase64))
        : decodePayload(frameBase64)
  const receivedAt = inspection.receivedAt && !Number.isNaN(Date.parse(inspection.receivedAt))
    ? formatDateTime(inspection.receivedAt)
    : inspection.receivedAt
  const dataRate = formatDataRate(inspection)
  const metadata = [
    [t('lorawan.device'), namedIdentifier(inspection.deviceName, inspection.deviceId)],
    [t('lorawan.devEui'), inspection.devEui],
    [t('lorawan.application'), namedIdentifier(inspection.applicationName, inspection.applicationId)],
    ['FPort', inspection.fPort === undefined ? undefined : formatNumber(inspection.fPort)],
    [t('lorawan.frameCounter'), inspection.frameCounter === undefined
      ? undefined
      : formatNumber(inspection.frameCounter)],
    [t('lorawan.received'), receivedAt],
    [t('lorawan.frequency'), inspection.frequencyHz === undefined
      ? undefined
      : formatFrequency(inspection.frequencyHz)],
    [t('lorawan.dataRate'), dataRate],
    [t('lorawan.confirmed'), inspection.confirmed === undefined
      ? undefined
      : t(inspection.confirmed ? 'common.yes' : 'common.no')]
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string')

  return (
    <div className="lorawan-inspector" role="tabpanel">
      <div className="lorawan-heading">
        <div>
          <span className="eyebrow">{t('lorawan.detected')}</span>
          <h3>{t(`lorawan.provider.${inspection.provider}`)}</h3>
        </div>
        <span className="lorawan-badge">LoRaWAN</span>
      </div>

      <dl className="lorawan-metadata">
        {metadata.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd title={value}>{value}</dd>
          </div>
        ))}
      </dl>

      {inspection.decodedPayload !== undefined && (
        <section className="lorawan-section">
          <h4>{t('lorawan.decodedPayload')}</h4>
          <pre>{JSON.stringify(inspection.decodedPayload, null, 2)}</pre>
        </section>
      )}

      <section className="lorawan-section">
        <div className="lorawan-section-heading">
          <div>
            <h4>{t('lorawan.framePayload')}</h4>
            {frameBase64 !== undefined && (
              <code title={frameBase64}>{t('lorawan.base64')}: {frameBase64 || '∅'}</code>
            )}
          </div>
          {frameBase64 !== undefined && frameKind !== undefined && (
            <div className="payload-inspector-actions">
              <span className={`payload-kind ${frameKind}`}>{t(`payload.kind.${frameKind}`)}</span>
              <button
                type="button"
                onClick={() => downloadBase64(
                  frameBase64,
                  frameFilename(message, inspection, frameKind)
                )}
              >
                <DownloadIcon width={14} height={14} />
                {t('lorawan.rawFrame')}
              </button>
            </div>
          )}
        </div>
        {frameBase64 === undefined
          ? <p className="lorawan-empty">{t('lorawan.noFramePayload')}</p>
          : <pre className={frameKind === 'binary' ? 'hex-dump' : ''}>{frameContent || t('common.emptyPayload')}</pre>}
      </section>

      {inspection.gateways.length > 0 && (
        <section className="lorawan-section">
          <h4>{t('lorawan.gatewayReception', { count: formatNumber(inspection.gateways.length) })}</h4>
          <div className="lorawan-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('lorawan.gateway')}</th>
                  <th>RSSI</th>
                  <th>SNR</th>
                </tr>
              </thead>
              <tbody>
                {inspection.gateways.map((gateway, index) => (
                  <tr key={`${gateway.gatewayId ?? gateway.gatewayEui ?? 'gateway'}-${index}`}>
                    <td>{namedIdentifier(gateway.gatewayId, gateway.gatewayEui) ?? t('common.unknown')}</td>
                    <td>{gateway.rssi === undefined ? '—' : `${formatNumber(gateway.rssi)} dBm`}</td>
                    <td>{gateway.snr === undefined ? '—' : `${formatNumber(gateway.snr)} dB`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export function PayloadInspector({ message }: PayloadInspectorProps) {
  const { t, formatNumber } = useI18n()
  const kind = detectPayloadKind(message.payloadBase64)
  const loRaWanInspection = useMemo(
    () => inspectLoRaWanUplink(message.payloadText),
    [message.payloadText]
  )
  const [mode, setMode] = useState<PayloadViewMode>(
    () => initialMode(kind, loRaWanInspection !== null)
  )
  const payloadBytes = decodePayloadBytes(message.payloadBase64)
  const previewTruncated = payloadBytes.byteLength > MAX_PREVIEW_BYTES
  const decodedText = previewTruncated
    ? new TextDecoder().decode(payloadBytes.subarray(0, MAX_PREVIEW_BYTES))
    : decodePayload(message.payloadBase64)
  const content = mode === 'hex'
    ? formatHexDump(
        message.payloadBase64,
        16,
        MAX_PREVIEW_BYTES,
        (count) => t('payload.additionalBytes', { count: formatNumber(count) })
      )
    : mode === 'json'
      ? prettyPayload(decodedText)
      : decodedText

  const download = (): void => {
    downloadBase64(message.payloadBase64, payloadFilename(message, kind))
  }

  return (
    <div className="payload-inspector">
      <div className="payload-inspector-toolbar">
        <div className="payload-view-tabs" role="tablist" aria-label={t('payload.view')}>
          {loRaWanInspection && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'lorawan'}
              className={mode === 'lorawan' ? 'active' : ''}
              onClick={() => setMode('lorawan')}
            >
              LoRaWAN
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'text'}
            className={mode === 'text' ? 'active' : ''}
            onClick={() => setMode('text')}
          >
            {t('payload.text')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'json'}
            className={mode === 'json' ? 'active' : ''}
            disabled={kind !== 'json'}
            title={t(kind === 'json' ? 'payload.formattedJson' : 'payload.invalidJson')}
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
            {t('payload.hex')}
          </button>
        </div>
        <div className="payload-inspector-actions">
          <span className={`payload-kind ${kind}`}>{t(`payload.kind.${kind}`)}</span>
          <button type="button" onClick={download}>
            <DownloadIcon width={14} height={14} />
            {t('payload.raw')}
          </button>
        </div>
      </div>
      {mode === 'lorawan' && loRaWanInspection
        ? <LoRaWanInspector message={message} inspection={loRaWanInspection} />
        : (
            <>
              {kind === 'binary' && mode === 'text' && (
                <p className="payload-inspector-note">
                  {t('payload.binaryWarning')}
                </p>
              )}
              {previewTruncated && mode !== 'hex' && (
                <p className="payload-inspector-note">
                  {t('payload.previewLimit')}
                </p>
              )}
              <pre className={mode === 'hex' ? 'hex-dump' : ''} role="tabpanel">
                {content || t('common.emptyPayload')}
              </pre>
            </>
          )}
    </div>
  )
}
