import { useMemo, useState } from 'react'
import type {
  CaptureFile,
  MqttVersion,
  ReplayOptions,
  ReplayPreset,
  ReplayProgress
} from '../../../shared/contracts'
import { formatBytes } from '../../../shared/message'
import { publishTopicError } from '../../../shared/mqtt-topic'
import { toMqttPublishProperties } from '../../../shared/mqtt-properties'
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
import { XIcon } from './icons'

const replayStateKeys: Record<ReplayProgress['state'], TranslationKey> = {
  idle: 'replay.state.idle',
  running: 'replay.state.running',
  paused: 'replay.state.paused',
  completed: 'replay.state.completed',
  cancelled: 'replay.state.cancelled'
}

interface ReplayDialogProps {
  capture: CaptureFile
  mqttVersion: MqttVersion
  progress: ReplayProgress
  onStart: (options: ReplayOptions) => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onClose: () => void
}

export function ReplayDialog({
  capture,
  mqttVersion,
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
  const mqtt5PropertyMessages = replayPlan.filter(({ message }) =>
    toMqttPublishProperties(message.properties) !== undefined
  )
  const receiveOnlyPropertyMessages = replayPlan.filter(({ message }) =>
    message.properties?.topicAlias !== undefined ||
    Boolean(message.properties?.subscriptionIdentifiers?.length)
  )
  const mqtt5PropertiesBlocked = mqttVersion !== 5 && mqtt5PropertyMessages.length > 0
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
    <div className="backdrop">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="replay-title">
        <header className="dialog-head">
          <div className="dialog-title">
            <span className="eyebrow">{t('replay.eyebrow')}</span>
            <h2 id="replay-title">{t('replay.title')}</h2>
          </div>
          <span className={`tag state-${progress.state}`}>{t(replayStateKeys[progress.state])}</span>
          <button
            className="btn plain icon"
            type="button"
            disabled={active}
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <XIcon width={16} height={16} />
          </button>
        </header>

        <div className="dialog-body">
          <dl className="summary-grid">
            <div><dt>{t('common.broker')}</dt><dd className="mono">{capture.connection.host || t('common.unknown')}</dd></div>
            <div><dt>{t('replay.recorded')}</dt><dd className="mono">{formatDateTime(capture.exportedAt)}</dd></div>
            <div><dt>{t('common.messages')}</dt><dd className="mono">{formatNumber(capture.messages.length)}</dd></div>
            <div><dt>{t('common.selected')}</dt><dd className="mono">{formatNumber(selectedMessages.length)}</dd></div>
          </dl>

          <section className="subpanel">
            <div className="subpanel-head">
              <h3>{t('replay.presetsTitle')}</h3>
              <span className="badge">{t('replay.savedCount', { count: formatNumber(presets.length) })}</span>
            </div>
            <div className="preset-row">
              <label className="field">
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
              <label className="field">
                <span>{t('replay.presetName')}</span>
                <input
                  value={presetName}
                  maxLength={80}
                  disabled={active}
                  placeholder={t('replay.presetPlaceholder')}
                  onChange={(event) => setPresetName(event.target.value)}
                />
              </label>
              <div className="preset-actions">
                <button
                  className="btn ghost"
                  type="button"
                  disabled={active || !presetName.trim() || (!includeIncoming && !includeOutgoing)}
                  onClick={savePreset}
                >
                  {t(selectedPresetId ? 'common.update' : 'common.save')}
                </button>
                <button
                  className="btn danger"
                  type="button"
                  disabled={active || !selectedPresetId}
                  onClick={removePreset}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
            <p className="hint">{t('replay.presetHelp')}</p>
            {presetFeedback.message && (
              <p
                className={`feedback ${presetFeedback.error ? 'invalid' : ''}`}
                role={presetFeedback.error ? 'alert' : 'status'}
              >
                {translateMessage(presetFeedback.message)}
              </p>
            )}
          </section>

          <div className="option-row">
            <fieldset className="option-group">
              <legend>{t('replay.directions')}</legend>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={includeOutgoing}
                  disabled={active}
                  onChange={(event) => setIncludeOutgoing(event.target.checked)}
                />
                <span>{t('common.outgoing')}</span>
                <small className="tag">{formatNumber(outgoing)}</small>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={includeIncoming}
                  disabled={active}
                  onChange={(event) => setIncludeIncoming(event.target.checked)}
                />
                <span>{t('common.incoming')}</span>
                <small className="tag">{formatNumber(incoming)}</small>
              </label>
            </fieldset>
            <label className="field speed-field">
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

          <section className="subpanel">
            <div className="subpanel-head">
              <h3>{t('replay.remapTitle')}</h3>
              <span className="badge">{t('replay.changedCount', { count: formatNumber(remappedMessages.length) })}</span>
            </div>
            <div className="remap-row">
              <label className="field">
                <span>{t('replay.sourcePrefix')}</span>
                <input
                  className="mono"
                  value={fromPrefix}
                  disabled={active}
                  placeholder="production/devices"
                  onChange={(event) => setFromPrefix(event.target.value)}
                />
              </label>
              <span className="arrow" aria-hidden="true">→</span>
              <label className="field">
                <span>{t('replay.targetPrefix')}</span>
                <input
                  className="mono"
                  value={toPrefix}
                  disabled={active}
                  placeholder="sandbox/replay"
                  onChange={(event) => setToPrefix(event.target.value)}
                />
              </label>
            </div>
            <p className="hint">{t('replay.remapHelp')}</p>
            {remappedMessages.length > 0 && (
              <ul className="remap-preview" aria-label={t('replay.remapPreview')}>
                {remappedMessages.slice(0, 3).map(({ message, topic }) => (
                  <li key={message.id}>
                    <span className="mono">{message.topic}</span>
                    <i aria-hidden="true">→</i>
                    <strong className="mono">{topic || t('common.emptyTopic')}</strong>
                  </li>
                ))}
                {remappedMessages.length > 3 && (
                  <li className="hint">{t('common.moreMessages', { count: formatNumber(remappedMessages.length - 3) })}</li>
                )}
              </ul>
            )}
          </section>

          {(mqtt5PropertyMessages.length > 0 || receiveOnlyPropertyMessages.length > 0) && (
            <div className={`notice ${mqtt5PropertiesBlocked ? 'error' : 'info'}`}>
              <strong>
                {t(mqtt5PropertiesBlocked
                  ? 'replay.mqtt5PropertiesBlocked'
                  : mqtt5PropertyMessages.length > 0
                    ? 'replay.mqtt5PropertiesPreserved'
                    : 'replay.mqtt5ReceiveOnlyOmitted', {
                  count: formatNumber(
                    mqtt5PropertyMessages.length || receiveOnlyPropertyMessages.length
                  )
                })}
              </strong>
              <span>
                {t(mqtt5PropertiesBlocked
                  ? 'replay.mqtt5PropertiesMqtt5Required'
                  : 'replay.mqtt5PropertiesHelp')}
              </span>
            </div>
          )}

          <div className={`notice ${invalidTopic ? 'error' : 'warn'}`}>
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
            <div className="progress">
              <progress max={Math.max(progress.total, 1)} value={progress.sent} aria-label={t('replay.progress')} />
              <p className="mono">
                {formatNumber(progress.sent)} / {formatNumber(progress.total)} · {percentage}%
                {progress.currentTopic ? ` · ${progress.currentTopic}` : ''}
              </p>
            </div>
          )}
        </div>

        <footer className="dialog-actions">
          {!active && progress.state !== 'completed' && progress.state !== 'cancelled' && (
            <button
              className="btn primary"
              type="button"
              disabled={
                selectedMessages.length === 0 || Boolean(invalidTopic) || mqtt5PropertiesBlocked
              }
              onClick={start}
            >
              {t('replay.start')}
            </button>
          )}
          {progress.state === 'running' && (
            <button className="btn ghost" type="button" onClick={onPause}>{t('replay.pause')}</button>
          )}
          {progress.state === 'paused' && (
            <button className="btn primary" type="button" onClick={onResume}>{t('replay.resume')}</button>
          )}
          {active && (
            <button className="btn danger" type="button" onClick={onCancel}>{t('common.cancel')}</button>
          )}
          <button className="btn ghost" type="button" disabled={active} onClick={onClose}>
            {t(progress.state === 'idle' ? 'common.back' : 'common.close')}
          </button>
        </footer>
      </section>
    </div>
  )
}
