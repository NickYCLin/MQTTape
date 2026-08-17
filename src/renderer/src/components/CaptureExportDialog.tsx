import { useMemo, useState } from 'react'
import { createCaptureTrimPlan, type CaptureTrimOptions } from '../../../shared/capture'
import type { CaptureFile } from '../../../shared/contracts'
import { formatBytes } from '../../../shared/message'
import { useI18n } from '../i18n'
import { XIcon } from './icons'

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
    <div className="backdrop">
      <section
        className="dialog wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-export-title"
      >
        <header className="dialog-head">
          <div className="dialog-title">
            <span className="eyebrow">{t('capture.eyebrow')}</span>
            <h2 id="capture-export-title">{t('capture.title')}</h2>
          </div>
          <span className="badge">
            {t('capture.kept', {
              selected: formatNumber(plan.messages.length),
              total: formatNumber(capture.messages.length)
            })}
          </span>
          <button
            className="btn plain icon"
            type="button"
            disabled={exporting}
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <XIcon width={16} height={16} />
          </button>
        </header>

        <div className="dialog-body">
          <dl className="summary-grid">
            <div><dt>{t('common.broker')}</dt><dd className="mono">{capture.connection.host || t('common.unknown')}</dd></div>
            <div><dt>{t('common.selected')}</dt><dd className="mono">{formatMessageCount(plan.messages.length)}</dd></div>
            <div><dt>{t('common.payload')}</dt><dd className="mono">{formatBytes(selectedBytes)}</dd></div>
            <div><dt>{t('capture.timeSpan')}</dt><dd className="mono">{formatTimeSpan(Math.max(selectedSpan, 0))}</dd></div>
          </dl>

          <section className="subpanel">
            <div className="trim-row">
              <fieldset className="option-group">
                <legend>{t('capture.directions')}</legend>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={includeIncoming}
                    disabled={exporting}
                    onChange={(event) => setIncludeIncoming(event.target.checked)}
                  />
                  <span>{t('common.incoming')}</span>
                  <small className="tag">{formatNumber(incoming)}</small>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={includeOutgoing}
                    disabled={exporting}
                    onChange={(event) => setIncludeOutgoing(event.target.checked)}
                  />
                  <span>{t('common.outgoing')}</span>
                  <small className="tag">{formatNumber(outgoing)}</small>
                </label>
              </fieldset>
              <label className="field">
                <span>{t('capture.query')}</span>
                <input
                  value={query}
                  disabled={exporting}
                  placeholder={t('capture.queryPlaceholder')}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="range-row">
                <label className="field">
                  <span>{t('capture.startTime')}</span>
                  <input
                    className="mono"
                    type="datetime-local"
                    step="0.001"
                    min={earliestValue}
                    max={latestValue}
                    value={fromTimestamp}
                    disabled={exporting}
                    onChange={(event) => setFromTimestamp(event.target.value)}
                  />
                </label>
                <span className="arrow" aria-hidden="true">→</span>
                <label className="field">
                  <span>{t('capture.endTime')}</span>
                  <input
                    className="mono"
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
          </section>

          {plan.messages.length > 0 && (
            <section className="subpanel" aria-label={t('capture.preview')}>
              <div className="subpanel-head">
                <h3>{t('capture.firstMessages')}</h3>
                <span className="badge">{t('capture.retainedCount', { count: formatNumber(retained) })}</span>
              </div>
              <ul className="trim-preview">
                {plan.messages.slice(0, 5).map((message) => (
                  <li key={message.id}>
                    <span className={`dir ${message.direction}`}>{message.direction === 'incoming' ? 'IN' : 'OUT'}</span>
                    <strong className="mono">{message.topic}</strong>
                    <time className="mono">{formatTime(message.timestamp)}</time>
                  </li>
                ))}
                {plan.messages.length > 5 && (
                  <li className="hint">{t('common.moreMessages', { count: formatNumber(plan.messages.length - 5) })}</li>
                )}
              </ul>
            </section>
          )}

          <div className={`notice ${plan.error || plan.messages.length === 0 ? 'error' : 'warn'}`}>
            <strong>
              {plan.error ? translateMessage(plan.error) : plan.messages.length === 0
                ? t('capture.noMatch')
                : t('capture.ready', { count: formatMessageCount(plan.messages.length) })}
            </strong>
            <span>{t('capture.privacy')}</span>
          </div>
        </div>

        <footer className="dialog-actions">
          <button className="btn plain" type="button" disabled={exporting} onClick={reset}>
            {t('capture.resetFilters')}
          </button>
          <button className="btn ghost" type="button" disabled={exporting} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={exporting || Boolean(plan.error) || plan.messages.length === 0}
            onClick={() => void exportCapture()}
          >
            {t(exporting ? 'capture.exporting' : 'capture.exportAction')}
          </button>
        </footer>
      </section>
    </div>
  )
}
