import { useMemo, useState } from 'react'
import { createCaptureTrimPlan, type CaptureTrimOptions } from '../../../shared/capture'
import type { CaptureFile } from '../../../shared/contracts'
import { formatBytes } from '../../../shared/message'

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

function formatTimeSpan(milliseconds: number): string {
  if (milliseconds < 1_000) return '<1 sec'
  const seconds = Math.round(milliseconds / 1_000)
  if (seconds < 60) return `${seconds} sec`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  return `${hours} hr`
}

function formatMessageCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'message' : 'messages'}`
}

export function CaptureExportDialog({ capture, onExport, onClose }: CaptureExportDialogProps) {
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
            <span className="eyebrow">CAPTURE TRIMMING</span>
            <h2 id="capture-export-title">Review messages before export</h2>
          </div>
          <span className="counter-badge">
            {plan.messages.length.toLocaleString()} / {capture.messages.length.toLocaleString()} KEPT
          </span>
        </div>

        <div className="capture-summary">
          <div><span>Broker</span><strong>{capture.connection.host || 'Unknown'}</strong></div>
          <div><span>Selected</span><strong>{formatMessageCount(plan.messages.length)}</strong></div>
          <div><span>Payload</span><strong>{formatBytes(selectedBytes)}</strong></div>
          <div><span>Time span</span><strong>{formatTimeSpan(Math.max(selectedSpan, 0))}</strong></div>
        </div>

        <div className="capture-trim-options">
          <div className="direction-options">
            <span>Directions to keep</span>
            <label>
              <input
                type="checkbox"
                checked={includeIncoming}
                disabled={exporting}
                onChange={(event) => setIncludeIncoming(event.target.checked)}
              />
              Incoming <small>{incoming.toLocaleString()}</small>
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeOutgoing}
                disabled={exporting}
                onChange={(event) => setIncludeOutgoing(event.target.checked)}
              />
              Outgoing <small>{outgoing.toLocaleString()}</small>
            </label>
          </div>
          <label className="capture-query-field">
            <span>Topic or payload contains</span>
            <input
              value={query}
              disabled={exporting}
              placeholder="factory/line-a or stopped"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="capture-time-range">
            <label>
              <span>Start time</span>
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
              <span>End time</span>
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
          <div className="capture-trim-preview" aria-label="Selected capture preview">
            <div className="capture-trim-preview-heading">
              <span>First selected messages</span>
              <small>{retained.toLocaleString()} retained</small>
            </div>
            {plan.messages.slice(0, 5).map((message) => (
              <div className="capture-trim-preview-row" key={message.id}>
                <i className={message.direction}>{message.direction === 'incoming' ? 'IN' : 'OUT'}</i>
                <strong>{message.topic}</strong>
                <time>{new Date(message.timestamp).toLocaleTimeString()}</time>
              </div>
            ))}
            {plan.messages.length > 5 && (
              <small>and {(plan.messages.length - 5).toLocaleString()} more message(s)</small>
            )}
          </div>
        )}

        <div className={`replay-warning ${plan.error || plan.messages.length === 0 ? 'invalid' : ''}`}>
          <strong>
            {plan.error || (plan.messages.length === 0
              ? 'No messages match the current trim settings.'
              : `Ready to export ${formatMessageCount(plan.messages.length)}.`)}
          </strong>
          <span>
            The current session stays unchanged. Passwords and local TLS paths are not included.
          </span>
        </div>

        <div className="dialog-actions">
          <button className="secondary-button" type="button" disabled={exporting} onClick={reset}>
            Reset filters
          </button>
          <button className="secondary-button" type="button" disabled={exporting} onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={exporting || Boolean(plan.error) || plan.messages.length === 0}
            onClick={() => void exportCapture()}
          >
            {exporting ? 'Exporting…' : 'Export capture'}
          </button>
        </div>
      </section>
    </div>
  )
}
