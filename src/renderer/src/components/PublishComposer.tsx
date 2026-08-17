import { useState, type FormEvent } from 'react'
import type { MqttQos } from '../../../shared/contracts'
import { SendIcon } from './icons'
import { useI18n } from '../i18n'

interface PublishComposerProps {
  connected: boolean
  onPublish: (topic: string, payload: string, qos: MqttQos, retain: boolean) => Promise<boolean>
}

export function PublishComposer({ connected, onPublish }: PublishComposerProps) {
  const { t } = useI18n()
  const [topic, setTopic] = useState('')
  const [payload, setPayload] = useState('')
  const [qos, setQos] = useState<MqttQos>(0)
  const [retain, setRetain] = useState(false)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    await onPublish(topic, payload, qos, retain)
  }

  return (
    <form className="publish-composer" onSubmit={submit}>
      <div className="publish-heading">
        <span className="eyebrow">{t('publish.eyebrow')}</span>
        <div className="publish-options">
          <select
            aria-label={t('publish.qos')}
            value={qos}
            disabled={!connected}
            onChange={(event) => setQos(Number(event.target.value) as MqttQos)}
          >
            <option value={0}>QoS 0</option>
            <option value={1}>QoS 1</option>
            <option value={2}>QoS 2</option>
          </select>
          <label className="retain-toggle">
            <input
              type="checkbox"
              checked={retain}
              disabled={!connected}
              onChange={(event) => setRetain(event.target.checked)}
            />
            {t('publish.retain')}
          </label>
        </div>
      </div>
      <div className="publish-body">
        <input
          aria-label={t('publish.topic')}
          value={topic}
          disabled={!connected}
          placeholder={t('publish.topicPlaceholder')}
          spellCheck={false}
          onChange={(event) => setTopic(event.target.value)}
        />
        <textarea
          aria-label={t('publish.payload')}
          value={payload}
          disabled={!connected}
          placeholder={t('publish.payloadPlaceholder')}
          spellCheck={false}
          onChange={(event) => setPayload(event.target.value)}
        />
        <button type="submit" disabled={!connected || !topic.trim()}>
          <SendIcon />
          {t('publish.action')}
        </button>
      </div>
    </form>
  )
}
