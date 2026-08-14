import { useMemo, useState } from 'react'
import type { CaptureFile, ReplayOptions, ReplayProgress } from '../../../shared/contracts'
import { formatBytes } from '../../../shared/message'

interface ReplayDialogProps {
  capture: CaptureFile
  progress: ReplayProgress
  onStart: (options: ReplayOptions) => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onClose: () => void
}

const replaySpeeds = [0.25, 0.5, 1, 2, 4]

export function ReplayDialog({
  capture,
  progress,
  onStart,
  onPause,
  onResume,
  onCancel,
  onClose
}: ReplayDialogProps) {
  const [includeOutgoing, setIncludeOutgoing] = useState(true)
  const [includeIncoming, setIncludeIncoming] = useState(false)
  const [speed, setSpeed] = useState(1)
  const active = progress.state === 'running' || progress.state === 'paused'
  const selectedMessages = useMemo(
    () => capture.messages.filter((message) =>
      message.direction === 'incoming' ? includeIncoming : includeOutgoing
    ),
    [capture.messages, includeIncoming, includeOutgoing]
  )
  const outgoing = capture.messages.filter((message) => message.direction === 'outgoing').length
  const incoming = capture.messages.length - outgoing
  const retained = selectedMessages.filter((message) => message.retain).length
  const selectedBytes = selectedMessages.reduce((total, message) => total + message.size, 0)
  const percentage = progress.total === 0 ? 0 : Math.round((progress.sent / progress.total) * 100)

  const start = (): void => {
    onStart({ includeIncoming, includeOutgoing, speed })
  }

  return (
    <div className="dialog-backdrop">
      <section className="replay-dialog" role="dialog" aria-modal="true" aria-labelledby="replay-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">SAFE REPLAY</span>
            <h2 id="replay-title">Review capture before publishing</h2>
          </div>
          <span className={`replay-state ${progress.state}`}>{progress.state}</span>
        </div>

        <div className="capture-summary">
          <div><span>Broker</span><strong>{capture.connection.host || 'Unknown'}</strong></div>
          <div><span>Recorded</span><strong>{new Date(capture.exportedAt).toLocaleString()}</strong></div>
          <div><span>Messages</span><strong>{capture.messages.length.toLocaleString()}</strong></div>
          <div><span>Selected</span><strong>{selectedMessages.length.toLocaleString()}</strong></div>
        </div>

        <div className="replay-options">
          <div className="direction-options">
            <span>Directions to publish</span>
            <label>
              <input
                type="checkbox"
                checked={includeOutgoing}
                disabled={active}
                onChange={(event) => setIncludeOutgoing(event.target.checked)}
              />
              Outgoing <small>{outgoing}</small>
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeIncoming}
                disabled={active}
                onChange={(event) => setIncludeIncoming(event.target.checked)}
              />
              Incoming <small>{incoming}</small>
            </label>
          </div>
          <label className="replay-speed">
            <span>Replay speed</span>
            <select
              value={speed}
              disabled={active}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              {replaySpeeds.map((value) => (
                <option value={value} key={value}>{value}×</option>
              ))}
            </select>
          </label>
        </div>

        <div className="replay-warning">
          <strong>{retained > 0 ? `${retained} retained message(s) selected.` : 'No retained messages selected.'}</strong>
          <span>{formatBytes(selectedBytes)} will be published to the currently connected broker.</span>
        </div>

        {progress.state !== 'idle' && (
          <div className="replay-progress">
            <progress max={Math.max(progress.total, 1)} value={progress.sent} aria-label="Replay progress" />
            <p>
              {progress.sent.toLocaleString()} / {progress.total.toLocaleString()} · {percentage}%
              {progress.currentTopic ? ` · ${progress.currentTopic}` : ''}
            </p>
          </div>
        )}

        <div className="dialog-actions">
          {!active && progress.state !== 'completed' && progress.state !== 'cancelled' && (
            <button
              className="primary-button"
              type="button"
              disabled={selectedMessages.length === 0}
              onClick={start}
            >
              Start replay
            </button>
          )}
          {progress.state === 'running' && (
            <button className="secondary-button" type="button" onClick={onPause}>Pause</button>
          )}
          {progress.state === 'paused' && (
            <button className="primary-button" type="button" onClick={onResume}>Resume</button>
          )}
          {active && (
            <button className="danger-button" type="button" onClick={onCancel}>Cancel</button>
          )}
          <button className="secondary-button" type="button" disabled={active} onClick={onClose}>
            {progress.state === 'idle' ? 'Back' : 'Close'}
          </button>
        </div>
      </section>
    </div>
  )
}
