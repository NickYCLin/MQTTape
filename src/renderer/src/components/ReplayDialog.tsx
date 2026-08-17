import { useMemo, useState } from 'react'
import type {
  CaptureFile,
  ReplayOptions,
  ReplayPreset,
  ReplayProgress
} from '../../../shared/contracts'
import { formatBytes } from '../../../shared/message'
import { publishTopicError } from '../../../shared/mqtt-topic'
import { createReplayPlan } from '../../../shared/replay'
import {
  deleteReplayPreset,
  readReplayPresets,
  REPLAY_PRESET_SPEEDS,
  upsertReplayPreset,
  writeReplayPresets
} from '../lib/replay-presets'

interface ReplayDialogProps {
  capture: CaptureFile
  progress: ReplayProgress
  onStart: (options: ReplayOptions) => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onClose: () => void
}

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
  const [fromPrefix, setFromPrefix] = useState('')
  const [toPrefix, setToPrefix] = useState('')
  const [presets, setPresets] = useState<ReplayPreset[]>(() =>
    readReplayPresets(window.localStorage)
  )
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetFeedback, setPresetFeedback] = useState<{ message: string; error: boolean }>({
    message: '',
    error: false
  })
  const active = progress.state === 'running' || progress.state === 'paused'
  const replayOptions = useMemo<ReplayOptions>(
    () => ({
      includeIncoming,
      includeOutgoing,
      speed,
      topicRemap: fromPrefix || toPrefix ? { fromPrefix, toPrefix } : undefined
    }),
    [fromPrefix, includeIncoming, includeOutgoing, speed, toPrefix]
  )
  const replayPlan = useMemo(
    () => createReplayPlan(capture.messages, replayOptions),
    [capture.messages, replayOptions]
  )
  const selectedMessages = replayPlan.map(({ message }) => message)
  const remappedMessages = replayPlan.filter(({ remapped }) => remapped)
  const invalidTopic = replayPlan
    .map(({ topic }) => ({ topic, error: publishTopicError(topic) }))
    .find(({ error }) => error)
  const outgoing = capture.messages.filter((message) => message.direction === 'outgoing').length
  const incoming = capture.messages.length - outgoing
  const retained = selectedMessages.filter((message) => message.retain).length
  const selectedBytes = selectedMessages.reduce((total, message) => total + message.size, 0)
  const percentage = progress.total === 0 ? 0 : Math.round((progress.sent / progress.total) * 100)

  const start = (): void => {
    onStart(replayOptions)
  }

  const selectPreset = (id: string): void => {
    setSelectedPresetId(id)
    setPresetFeedback({ message: '', error: false })

    if (!id) {
      setPresetName('')
      return
    }

    const preset = presets.find((candidate) => candidate.id === id)
    if (!preset) return

    setPresetName(preset.name)
    setIncludeIncoming(preset.options.includeIncoming)
    setIncludeOutgoing(preset.options.includeOutgoing)
    setSpeed(preset.options.speed)
    setFromPrefix(preset.options.topicRemap?.fromPrefix || '')
    setToPrefix(preset.options.topicRemap?.toPrefix || '')
    setPresetFeedback({ message: `Applied “${preset.name}”.`, error: false })
  }

  const savePreset = (): void => {
    try {
      const result = upsertReplayPreset(presets, {
        id: selectedPresetId || undefined,
        name: presetName,
        options: replayOptions
      }, () => window.crypto.randomUUID())
      writeReplayPresets(window.localStorage, result.presets)
      setPresets(result.presets)
      setSelectedPresetId(result.preset.id)
      setPresetName(result.preset.name)
      setPresetFeedback({ message: `Saved “${result.preset.name}” locally.`, error: false })
    } catch (reason) {
      setPresetFeedback({
        message: reason instanceof Error ? reason.message : String(reason),
        error: true
      })
    }
  }

  const removePreset = (): void => {
    const preset = presets.find((candidate) => candidate.id === selectedPresetId)
    if (!preset) return

    try {
      const next = deleteReplayPreset(presets, preset.id)
      writeReplayPresets(window.localStorage, next)
      setPresets(next)
      setSelectedPresetId('')
      setPresetName('')
      setPresetFeedback({ message: `Deleted “${preset.name}”.`, error: false })
    } catch (reason) {
      setPresetFeedback({
        message: reason instanceof Error ? reason.message : String(reason),
        error: true
      })
    }
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

        <div className="replay-preset-section">
          <div className="replay-preset-heading">
            <div>
              <span className="eyebrow">REUSABLE SETTINGS</span>
              <h3>Replay presets</h3>
            </div>
            <span className="counter-badge">{presets.length.toLocaleString()} SAVED</span>
          </div>
          <div className="replay-preset-controls">
            <label className="replay-preset-field">
              <span>Saved preset</span>
              <select
                aria-label="Saved replay preset"
                value={selectedPresetId}
                disabled={active}
                onChange={(event) => selectPreset(event.target.value)}
              >
                <option value="">Custom settings / new preset</option>
                {presets.map((preset) => (
                  <option value={preset.id} key={preset.id}>{preset.name}</option>
                ))}
              </select>
            </label>
            <label className="replay-preset-field">
              <span>Preset name</span>
              <input
                value={presetName}
                maxLength={80}
                disabled={active}
                placeholder="Production to sandbox"
                onChange={(event) => setPresetName(event.target.value)}
              />
            </label>
            <div className="replay-preset-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={active || !presetName.trim() || (!includeIncoming && !includeOutgoing)}
                onClick={savePreset}
              >
                {selectedPresetId ? 'Update' : 'Save'}
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={active || !selectedPresetId}
                onClick={removePreset}
              >
                Delete
              </button>
            </div>
          </div>
          <p className="replay-preset-help">
            Stored only on this device. Presets contain replay settings, never broker credentials or capture payloads.
          </p>
          {presetFeedback.message && (
            <p
              className={`replay-preset-feedback ${presetFeedback.error ? 'invalid' : ''}`}
              role={presetFeedback.error ? 'alert' : 'status'}
            >
              {presetFeedback.message}
            </p>
          )}
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
              {REPLAY_PRESET_SPEEDS.map((value) => (
                <option value={value} key={value}>{value}×</option>
              ))}
            </select>
          </label>
        </div>

        <div className="topic-remap-section">
          <div className="topic-remap-heading">
            <div>
              <span className="eyebrow">OPTIONAL SAFETY ROUTING</span>
              <h3>Topic prefix remapping</h3>
            </div>
            <span className="counter-badge">{remappedMessages.length.toLocaleString()} CHANGED</span>
          </div>
          <div className="topic-remap-fields">
            <label>
              <span>Source prefix</span>
              <input
                value={fromPrefix}
                disabled={active}
                placeholder="production/devices"
                onChange={(event) => setFromPrefix(event.target.value)}
              />
            </label>
            <span className="remap-arrow" aria-hidden="true">→</span>
            <label>
              <span>Target prefix</span>
              <input
                value={toPrefix}
                disabled={active}
                placeholder="sandbox/replay"
                onChange={(event) => setToPrefix(event.target.value)}
              />
            </label>
          </div>
          <p className="topic-remap-help">
            Leave both blank to keep original topics. A blank source prepends the target to every selected topic.
          </p>
          {remappedMessages.length > 0 && (
            <div className="topic-remap-preview" aria-label="Topic remapping preview">
              {remappedMessages.slice(0, 3).map(({ message, topic }) => (
                <div key={message.id}>
                  <span>{message.topic}</span>
                  <i>→</i>
                  <strong>{topic || '(empty topic)'}</strong>
                </div>
              ))}
              {remappedMessages.length > 3 && (
                <small>and {(remappedMessages.length - 3).toLocaleString()} more message(s)</small>
              )}
            </div>
          )}
        </div>

        <div className={`replay-warning ${invalidTopic ? 'invalid' : ''}`}>
          <strong>
            {invalidTopic
              ? `Invalid replay topic “${invalidTopic.topic}”.`
              : retained > 0
                ? `${retained} retained message(s) selected.`
                : 'No retained messages selected.'}
          </strong>
          <span>
            {invalidTopic?.error || `${formatBytes(selectedBytes)} will be published to the currently connected broker.`}
          </span>
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
              disabled={selectedMessages.length === 0 || Boolean(invalidTopic)}
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
