import { useMemo } from 'react'
import type { MqttMessageRecord } from '../../../shared/contracts'
import {
  buildLoRaWanDownlinkTracks,
  type LoRaWanDownlinkCorrelationBasis,
  type LoRaWanDownlinkEventKind,
  type LoRaWanDownlinkStatus
} from '../../../shared/lorawan-downlink-status'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../lib/i18n'

interface LoRaWanDownlinkTrackerProps {
  messages: MqttMessageRecord[]
  query: string
}

const statusKeys: Record<LoRaWanDownlinkStatus, TranslationKey> = {
  requested: 'downlinks.status.requested',
  queued: 'downlinks.status.queued',
  sent: 'downlinks.status.sent',
  acknowledged: 'downlinks.status.acknowledged',
  'not-acknowledged': 'downlinks.status.notAcknowledged',
  failed: 'downlinks.status.failed'
}

const eventKeys: Record<LoRaWanDownlinkEventKind, TranslationKey> = {
  request: 'downlinks.event.request',
  queued: 'downlinks.event.queued',
  sent: 'downlinks.event.sent',
  ack: 'downlinks.event.ack',
  nack: 'downlinks.event.nack',
  failed: 'downlinks.event.failed',
  txack: 'downlinks.event.txack'
}

const basisKeys: Record<LoRaWanDownlinkCorrelationBasis, TranslationKey> = {
  'correlation-id': 'downlinks.correlation.correlationId',
  'queue-item-id': 'downlinks.correlation.queueItemId',
  'device-order': 'downlinks.correlation.deviceOrder',
  none: 'downlinks.correlation.none'
}

export function LoRaWanDownlinkTracker({
  messages,
  query
}: LoRaWanDownlinkTrackerProps) {
  const { t, formatNumber, formatDateTime } = useI18n()
  const tracks = useMemo(() => buildLoRaWanDownlinkTracks(messages), [messages])
  const visibleTracks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return tracks
    return tracks.filter((track) => [
      track.provider,
      track.applicationId,
      track.deviceId,
      track.devEui,
      track.status,
      track.correlationId,
      track.queueItemId,
      ...track.events.flatMap((event) => [event.topic, event.kind, event.error])
    ].filter(Boolean).join('\n').toLocaleLowerCase().includes(normalized))
  }, [query, tracks])

  if (tracks.length === 0) {
    return (
      <div className="empty downlink-empty">
        <div className="empty-glyph" aria-hidden="true">↓✓</div>
        <h3>{t('downlinks.emptyTitle')}</h3>
        <p>{t('downlinks.emptyHelp')}</p>
        <div className="downlink-subscriptions">
          <code>v3/&lt;application-id&gt;/devices/+/down/#</code>
          <code>application/&lt;application-id&gt;/device/+/event/+</code>
        </div>
      </div>
    )
  }

  return (
    <div className="downlink-tracker">
      <header className="downlink-tracker-head">
        <div>
          <span className="eyebrow">{t('downlinks.eyebrow')}</span>
          <h3>{t('downlinks.title')}</h3>
          <p>{t('downlinks.help')}</p>
        </div>
        <span className="badge">{t('downlinks.count', { count: formatNumber(visibleTracks.length) })}</span>
      </header>

      {visibleTracks.length === 0 ? (
        <div className="placeholder">{t('downlinks.noMatch', { query })}</div>
      ) : (
        <div className="downlink-track-list">
          {visibleTracks.map((track) => {
            const latest = track.events.at(-1)
            const frame = [...track.events].reverse().find((event) => (
              event.fPort !== undefined || event.frameCounter !== undefined
            ))
            return (
              <article className="downlink-track" key={track.id}>
                <header className="downlink-track-head">
                  <div className="downlink-track-identity">
                    <span className="badge">{t(`lorawan.provider.${track.provider}`)}</span>
                    <strong>{track.deviceId}</strong>
                    {track.devEui && track.devEui !== track.deviceId && (
                      <code>{track.devEui}</code>
                    )}
                  </div>
                  <span className={`downlink-status status-${track.status}`}>
                    {t(statusKeys[track.status])}
                  </span>
                </header>

                <dl className="downlink-track-meta">
                  <div>
                    <dt>{t('lorawan.application')}</dt>
                    <dd className="mono">{track.applicationId}</dd>
                  </div>
                  <div>
                    <dt>{t('downlinks.correlation')}</dt>
                    <dd title={track.correlationId ?? track.queueItemId}>
                      {t(basisKeys[track.correlationBasis])}
                    </dd>
                  </div>
                  {frame?.fPort !== undefined && <div><dt>FPort</dt><dd>{frame.fPort}</dd></div>}
                  {frame?.frameCounter !== undefined && (
                    <div><dt>FCntDown</dt><dd>{formatNumber(frame.frameCounter)}</dd></div>
                  )}
                  <div>
                    <dt>{t('downlinks.lastEvent')}</dt>
                    <dd>{latest ? formatDateTime(latest.occurredAt) : '—'}</dd>
                  </div>
                </dl>

                <ol className="downlink-events">
                  {track.events.map((event) => (
                    <li className={`downlink-event status-${event.status}`} key={event.id}>
                      <i aria-hidden="true" />
                      <div className="downlink-event-copy">
                        <div className="downlink-event-line">
                          <strong>{t(event.kind === 'ack' && event.status === 'not-acknowledged'
                            ? eventKeys.nack
                            : eventKeys[event.kind])}</strong>
                          <time>{formatDateTime(event.occurredAt)}</time>
                        </div>
                        <code title={event.topic}>{event.topic}</code>
                        {event.error && <p className="downlink-error">{event.error}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
