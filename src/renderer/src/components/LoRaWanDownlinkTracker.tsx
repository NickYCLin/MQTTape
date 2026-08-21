import { useEffect, useMemo, useState } from 'react'
import type { MqttMessageRecord } from '../../../shared/contracts'
import {
  buildLoRaWanDownlinkTracksFromEvents,
  inspectLoRaWanDownlinkEvents,
  type LoRaWanDownlinkCorrelationBasis,
  type LoRaWanDownlinkEventKind,
  type LoRaWanDownlinkStatus
} from '../../../shared/lorawan-downlink-status'
import {
  MAX_DOWNLINK_HISTORY_EVENTS,
  canUseLoRaWanDownlinkHistoryStorage,
  clearLoRaWanDownlinkHistory,
  createLoRaWanDownlinkHistoryFile,
  filterLoRaWanDownlinkEventsAfter,
  mergeLoRaWanDownlinkHistoryEvents,
  readLoRaWanDownlinkHistory,
  readLoRaWanDownlinkHistoryClearedAt,
  writeLoRaWanDownlinkHistory,
  writeLoRaWanDownlinkHistoryClearedAt,
  type LoRaWanDownlinkHistoryFile
} from '../../../shared/lorawan-downlink-history'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../lib/i18n'
import { DownloadIcon, TrashIcon } from './icons'

interface LoRaWanDownlinkTrackerProps {
  messages: MqttMessageRecord[]
  query: string
  storageNamespace?: string
  onExport: (history: LoRaWanDownlinkHistoryFile) => Promise<boolean>
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

// The message buffer is re-inspected in full whenever it changes; caching per
// record keeps that scan O(new messages) instead of O(buffer) per message.
const inspectionCache = new WeakMap<MqttMessageRecord, ReturnType<typeof inspectLoRaWanDownlinkEvents>>()

function cachedInspectLoRaWanDownlinkEvents(message: MqttMessageRecord) {
  const cached = inspectionCache.get(message)
  if (cached) return cached
  const events = inspectLoRaWanDownlinkEvents(message)
  inspectionCache.set(message, events)
  return events
}

function readScopedHistory(storageNamespace: string | undefined, clearedAt: string | undefined) {
  const scopedEvents = filterLoRaWanDownlinkEventsAfter(
    readLoRaWanDownlinkHistory(window.localStorage, storageNamespace),
    clearedAt
  )
  if (!storageNamespace || scopedEvents.length > 0) return scopedEvents

  const legacyEvents = filterLoRaWanDownlinkEventsAfter(
    readLoRaWanDownlinkHistory(window.localStorage),
    clearedAt
  )
  if (legacyEvents.length === 0) return scopedEvents
  if (!writeLoRaWanDownlinkHistory(window.localStorage, legacyEvents, storageNamespace)) {
    return legacyEvents
  }
  clearLoRaWanDownlinkHistory(window.localStorage)
  return legacyEvents
}

export function LoRaWanDownlinkTracker({
  messages,
  query,
  storageNamespace,
  onExport
}: LoRaWanDownlinkTrackerProps) {
  const { t, formatNumber, formatDateTime } = useI18n()
  const [clearedAt, setClearedAt] = useState(() => (
    readLoRaWanDownlinkHistoryClearedAt(window.localStorage, storageNamespace)
  ))
  // Baseline holds what was loaded from storage at mount; everything else is
  // derived from the live message buffer, so no effect has to copy state.
  const [baselineEvents, setBaselineEvents] = useState(() => (
    readScopedHistory(
      storageNamespace,
      readLoRaWanDownlinkHistoryClearedAt(window.localStorage, storageNamespace)
    )
  ))
  const [storageAvailable] = useState(() => (
    canUseLoRaWanDownlinkHistoryStorage(window.localStorage, storageNamespace)
  ))
  const [exporting, setExporting] = useState(false)
  const observedEvents = useMemo(
    () => filterLoRaWanDownlinkEventsAfter(
      messages.flatMap(cachedInspectLoRaWanDownlinkEvents),
      clearedAt
    ),
    [clearedAt, messages]
  )
  const historyEvents = useMemo(
    () => (observedEvents.length === 0
      ? baselineEvents
      : mergeLoRaWanDownlinkHistoryEvents(baselineEvents, observedEvents)),
    [baselineEvents, observedEvents]
  )

  useEffect(() => {
    if (historyEvents.length === 0) return
    // Merge with whatever is stored so two sessions on the same broker do not
    // overwrite each other's observed events.
    const stored = filterLoRaWanDownlinkEventsAfter(
      readLoRaWanDownlinkHistory(window.localStorage, storageNamespace),
      clearedAt
    )
    writeLoRaWanDownlinkHistory(
      window.localStorage,
      stored.length > 0 ? mergeLoRaWanDownlinkHistoryEvents(stored, historyEvents) : historyEvents,
      storageNamespace
    )
  }, [clearedAt, historyEvents, storageNamespace])

  const tracks = useMemo(
    () => buildLoRaWanDownlinkTracksFromEvents(historyEvents),
    [historyEvents]
  )
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

  const clearHistory = (): void => {
    if (!window.confirm(t('downlinks.clearConfirm'))) return
    const nextClearedAt = new Date().toISOString()
    setClearedAt(nextClearedAt)
    writeLoRaWanDownlinkHistoryClearedAt(window.localStorage, nextClearedAt, storageNamespace)
    clearLoRaWanDownlinkHistory(window.localStorage, storageNamespace)
    setBaselineEvents([])
  }

  const exportHistory = async (): Promise<void> => {
    setExporting(true)
    try {
      await onExport(createLoRaWanDownlinkHistoryFile(historyEvents))
    } finally {
      setExporting(false)
    }
  }

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
          <p className="downlink-history-note">
            {t('downlinks.historyPrivacy', {
              count: formatNumber(MAX_DOWNLINK_HISTORY_EVENTS)
            })}
          </p>
        </div>
        <div className="downlink-tracker-summary">
          <span className="badge">{t('downlinks.count', { count: formatNumber(visibleTracks.length) })}</span>
          <span className="badge">
            {t('downlinks.historyCount', { count: formatNumber(historyEvents.length) })}
          </span>
          <div className="downlink-history-actions">
            <button
              className="btn ghost sm"
              type="button"
              disabled={exporting}
              onClick={() => void exportHistory()}
            >
              <DownloadIcon width={14} height={14} />
              {t(exporting ? 'downlinks.exporting' : 'downlinks.exportHistory')}
            </button>
            <button className="btn ghost sm" type="button" onClick={clearHistory}>
              <TrashIcon width={14} height={14} />
              {t('downlinks.clearHistory')}
            </button>
          </div>
        </div>
      </header>

      {!storageAvailable && (
        <p className="downlink-storage-warning" role="status">
          {t('downlinks.storageUnavailable')}
        </p>
      )}

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
