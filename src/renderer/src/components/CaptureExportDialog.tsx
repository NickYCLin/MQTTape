import { useMemo, useState } from 'react'
import { createCaptureTrimPlan, type CaptureTrimOptions } from '../../../shared/capture'
import type { CaptureFile } from '../../../shared/contracts'
import { formatBytes } from '../../../shared/message'
import { useI18n } from '../i18n'

interface CaptureExportDialogProps {
  capture: CaptureFile
  onExport: (capture: CaptureFile) => Promise<boolean>
  onClose: () => void
}

function localDateTimeValue(timestamp: number): string {
  const date = new Date(timestamp)
  const localTime = date.getTime() - date.getTimezoneOffset() * 60_000
  return new Date(localTime).toISOString().slice(0, 23)
}

export function CaptureExportDialog({ capture, onExport, onClose }: CaptureExportDialogProps) {
  const { t, translateMessage, formatNumber, formatTime } = useI18n()
  const messageTimes = useMemo(
    () => capture.messages.map((message) => Date.parse(message.timestamp)),
    [capture.messages]
  )
  const earliestTime = Math.min(...messageTimes)
  const latestTime = Math.max(...messageTimes)
  const earliestValue = localDateTimeValue(earliestTime)
  const latestValue = localDateTimeValue(latestTime)
  const [includeIncoming, setIncludeIncoming] = useState(true)
  const [includeOutgoing, setIncludeOutgoing] = useState(true)
  const [query, setQuery] = useState('')
  const [fromTimestamp, setFromTimestamp] = useState(earliestValue)
  const [toTimestamp, setToTimestamp] = useState(latestValue)
  const [exporting, setExporting] = useState(false)
  const options = useMemo<CaptureTrimOptions>(() => ({
    includeIncoming,
    includeOutgoing,
    query,
    fromTimestamp,
    toTimestamp
  }), [fromTimestamp, includeIncoming, includeOutgoing, query, toTimestamp])
  const plan = useMemo(
    () => createCaptureTrimPlan(capture.messages, options),
    [capture.messages, options]
  )
  const incoming = capture.messages.filter((message) => message.direction === 'incoming').length
  const outgoing = capture.messages.length - incoming
  const selectedBytes = plan.messages.reduce((total, message) => total + message.size, 0)
  const retained = plan.messages.filter((message) => message.retain).length
  const selectedSpan = plan.messages.length < 2
    ? 0
    : Date.parse(plan.messages.at(-1)!.timestamp) - Date.parse(plan.messages[0].timestamp)
  const formatMessageCount = (count: number): string =>
    t('capture.messageCount', { count: formatNumber(count) })
  const formatTimeSpan = (milliseconds: number): string => {
    if (milliseconds < 1_000) return t('capture.lessThanSecond')
    const seconds = Math.round(milliseconds / 1_000)
    if (seconds < 60) return t('capture.seconds', { count: formatNumber(seconds) })
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return t('capture.minutes', { count: formatNumber(minutes) })
    return t('capture.hours', { count: formatNumber(Math.round(minutes / 60)) })
  }

  const reset = (): void => {
    setIncludeIncoming(true)
    setIncludeOutgoing(true)
    setQuery('')
    setFromTimestamp(earliestValue)
    setToTimestamp(latestValue)
  }

  const exportCapture = async (): Promise<void> => {
    setExporting(true)
    try {
      const saved = await onExport({
        ...capture,
        exportedAt: new Date().toISOString(),
        messages: plan.messages
      })
      if (saved) onClose()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="dialog-backdrop">
      <section
        className="replay-dialog capture-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-export-title"
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">{t('capture.eyebrow')}</span>
            <h2 id="capture-export-title">{t('capture.title')}</h2>
          </div>
          <span className="counter-badge">
            {t('capture.kept', {
              selected: formatNumber(plan.messages.length),
              total: formatNumber(capture.messages.length)
            })}
          </span>
        </div>

        <div className="capture-summary">
          <div><span>{t('common.broker')}</span><strong>{capture.connection.host || t('common.unknown')}</strong></div>
          <div><span>{t('common.selected')}</span><strong>{formatMessageCount(plan.messages.length)}</strong></div>
          <div><span>{t('common.payload')}</span><strong>{formatBytes(selectedBytes)}</strong></div>
          <div><span>{t('capture.timeSpan')}</span><strong>{formatTimeSpan(Math.max(selectedSpan, 0))}</strong></div>
        </div>

        <div className="capture-trim-options">
          <div className="direction-options">
            <span>{t('capture.directions')}</span>
            <label>
              <input
                type="checkbox"
                checked={includeIncoming}
                disabled={exporting}
                onChange={(event) => setIncludeIncoming(event.target.checked)}
              />
              {t('common.incoming')} <small>{formatNumber(incoming)}</small>
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeOutgoing}
                disabled={exporting}
                onChange={(event) => setIncludeOutgoing(event.target.checked)}
              />
              {t('common.outgoing')} <small>{formatNumber(outgoing)}</small>
            </label>
          </div>
          <label className="capture-query-field">
            <span>{t('capture.query')}</span>
            <input
              value={query}
              disabled={exporting}
              placeholder={t('capture.queryPlaceholder')}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="capture-time-range">
            <label>
              <span>{t('capture.startTime')}</span>
              <input
                type="datetime-local"
                step="0.001"
                min={earliestValue}
                max={latestValue}
                value={fromTimestamp}
                disabled={exporting}
                onChange={(event) => setFromTimestamp(event.target.value)}
              />
            </label>
            <span className="trim-range-arrow" aria-hidden="true">→</span>
            <label>
              <span>{t('capture.endTime')}</span>
              <input
                type="datetime-local"
                step="0.001"
                min={earliestValue}
                max={latestValue}
                value={toTimestamp}
                disabled={exporting}
                onChange={(event) => setToTimestamp(event.target.value)}
              />
            </label>
          </div>
        </div>

        {plan.messages.length > 0 && (
          <div className="capture-trim-preview" aria-label={t('capture.preview')}>
            <div className="capture-trim-preview-heading">
              <span>{t('capture.firstMessages')}</span>
              <small>{t('capture.retainedCount', { count: formatNumber(retained) })}</small>
            </div>
            {plan.messages.slice(0, 5).map((message) => (
              <div className="capture-trim-preview-row" key={message.id}>
                <i className={message.direction}>{message.direction === 'incoming' ? 'IN' : 'OUT'}</i>
                <strong>{message.topic}</strong>
                <time>{formatTime(message.timestamp)}</time>
              </div>
            ))}
            {plan.messages.length > 5 && (
              <small>{t('common.moreMessages', { count: formatNumber(plan.messages.length - 5) })}</small>
            )}
          </div>
        )}

        <div className={`replay-warning ${plan.error || plan.messages.length === 0 ? 'invalid' : ''}`}>
          <strong>
            {plan.error ? translateMessage(plan.error) : plan.messages.length === 0
              ? t('capture.noMatch')
              : t('capture.ready', { count: formatMessageCount(plan.messages.length) })}
          </strong>
          <span>
            {t('capture.privacy')}
          </span>
        </div>

        <div className="dialog-actions">
          <button className="secondary-button" type="button" disabled={exporting} onClick={reset}>
            {t('capture.resetFilters')}
          </button>
          <button className="secondary-button" type="button" disabled={exporting} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={exporting || Boolean(plan.error) || plan.messages.length === 0}
            onClick={() => void exportCapture()}
          >
            {t(exporting ? 'capture.exporting' : 'capture.exportAction')}
          </button>
        </div>
      </section>
    </div>
  )
}
