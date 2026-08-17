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
import { useI18n } from '../i18n'
import type { TranslationKey } from '../lib/i18n'

const replayStateKeys: Record<ReplayProgress['state'], TranslationKey> = {
  idle: 'replay.state.idle',
  running: 'replay.state.running',
  paused: 'replay.state.paused',
  completed: 'replay.state.completed',
  cancelled: 'replay.state.cancelled'
}

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
  const { t, translateMessage, formatNumber, formatDateTime } = useI18n()
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
            <span className="eyebrow">{t('replay.eyebrow')}</span>
            <h2 id="replay-title">{t('replay.title')}</h2>
          </div>
          <span className={`replay-state ${progress.state}`}>{t(replayStateKeys[progress.state])}</span>
        </div>

        <div className="capture-summary">
          <div><span>{t('common.broker')}</span><strong>{capture.connection.host || t('common.unknown')}</strong></div>
          <div><span>{t('replay.recorded')}</span><strong>{formatDateTime(capture.exportedAt)}</strong></div>
          <div><span>{t('common.messages')}</span><strong>{formatNumber(capture.messages.length)}</strong></div>
          <div><span>{t('common.selected')}</span><strong>{formatNumber(selectedMessages.length)}</strong></div>
        </div>

        <div className="replay-preset-section">
          <div className="replay-preset-heading">
            <div>
              <span className="eyebrow">{t('replay.presetsEyebrow')}</span>
              <h3>{t('replay.presetsTitle')}</h3>
            </div>
            <span className="counter-badge">{t('replay.savedCount', { count: formatNumber(presets.length) })}</span>
          </div>
          <div className="replay-preset-controls">
            <label className="replay-preset-field">
              <span>{t('replay.savedPreset')}</span>
              <select
                aria-label={t('replay.savedPreset')}
                value={selectedPresetId}
                disabled={active}
                onChange={(event) => selectPreset(event.target.value)}
              >
                <option value="">{t('replay.customPreset')}</option>
                {presets.map((preset) => (
                  <option value={preset.id} key={preset.id}>{preset.name}</option>
                ))}
              </select>
            </label>
            <label className="replay-preset-field">
              <span>{t('replay.presetName')}</span>
              <input
                value={presetName}
                maxLength={80}
                disabled={active}
                placeholder={t('replay.presetPlaceholder')}
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
                {t(selectedPresetId ? 'common.update' : 'common.save')}
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={active || !selectedPresetId}
                onClick={removePreset}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
          <p className="replay-preset-help">
            {t('replay.presetHelp')}
          </p>
          {presetFeedback.message && (
            <p
              className={`replay-preset-feedback ${presetFeedback.error ? 'invalid' : ''}`}
              role={presetFeedback.error ? 'alert' : 'status'}
            >
              {translateMessage(presetFeedback.message)}
            </p>
          )}
        </div>

        <div className="replay-options">
          <div className="direction-options">
            <span>{t('replay.directions')}</span>
            <label>
              <input
                type="checkbox"
                checked={includeOutgoing}
                disabled={active}
                onChange={(event) => setIncludeOutgoing(event.target.checked)}
              />
              {t('common.outgoing')} <small>{formatNumber(outgoing)}</small>
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeIncoming}
                disabled={active}
                onChange={(event) => setIncludeIncoming(event.target.checked)}
              />
              {t('common.incoming')} <small>{formatNumber(incoming)}</small>
            </label>
          </div>
          <label className="replay-speed">
            <span>{t('replay.speed')}</span>
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
              <span className="eyebrow">{t('replay.routingEyebrow')}</span>
              <h3>{t('replay.remapTitle')}</h3>
            </div>
            <span className="counter-badge">{t('replay.changedCount', { count: formatNumber(remappedMessages.length) })}</span>
          </div>
          <div className="topic-remap-fields">
            <label>
              <span>{t('replay.sourcePrefix')}</span>
              <input
                value={fromPrefix}
                disabled={active}
                placeholder="production/devices"
                onChange={(event) => setFromPrefix(event.target.value)}
              />
            </label>
            <span className="remap-arrow" aria-hidden="true">→</span>
            <label>
              <span>{t('replay.targetPrefix')}</span>
              <input
                value={toPrefix}
                disabled={active}
                placeholder="sandbox/replay"
                onChange={(event) => setToPrefix(event.target.value)}
              />
            </label>
          </div>
          <p className="topic-remap-help">
            {t('replay.remapHelp')}
          </p>
          {remappedMessages.length > 0 && (
            <div className="topic-remap-preview" aria-label={t('replay.remapPreview')}>
              {remappedMessages.slice(0, 3).map(({ message, topic }) => (
                <div key={message.id}>
                  <span>{message.topic}</span>
                  <i>→</i>
                  <strong>{topic || t('common.emptyTopic')}</strong>
                </div>
              ))}
              {remappedMessages.length > 3 && (
                <small>{t('common.moreMessages', { count: formatNumber(remappedMessages.length - 3) })}</small>
              )}
            </div>
          )}
        </div>

        <div className={`replay-warning ${invalidTopic ? 'invalid' : ''}`}>
          <strong>
            {invalidTopic
              ? t('replay.invalidTopic', { topic: invalidTopic.topic })
              : retained > 0
                ? t('replay.retainedSelected', { count: formatNumber(retained) })
                : t('replay.noRetained')}
          </strong>
          <span>
            {invalidTopic?.error
              ? translateMessage(invalidTopic.error)
              : t('replay.publishBytes', { bytes: formatBytes(selectedBytes) })}
          </span>
        </div>

        {progress.state !== 'idle' && (
          <div className="replay-progress">
            <progress max={Math.max(progress.total, 1)} value={progress.sent} aria-label={t('replay.progress')} />
            <p>
              {formatNumber(progress.sent)} / {formatNumber(progress.total)} · {percentage}%
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
              {t('replay.start')}
            </button>
          )}
          {progress.state === 'running' && (
            <button className="secondary-button" type="button" onClick={onPause}>{t('replay.pause')}</button>
          )}
          {progress.state === 'paused' && (
            <button className="primary-button" type="button" onClick={onResume}>{t('replay.resume')}</button>
          )}
          {active && (
            <button className="danger-button" type="button" onClick={onCancel}>{t('common.cancel')}</button>
          )}
          <button className="secondary-button" type="button" disabled={active} onClick={onClose}>
            {t(progress.state === 'idle' ? 'common.back' : 'common.close')}
          </button>
        </div>
      </section>
    </div>
  )
}
