import { useState, type FormEvent } from 'react'
import type { MqttQos } from '../../../shared/contracts'
import { DownlinkIcon, SendIcon } from './icons'
import { useI18n } from '../i18n'
import { LoRaWanDownlinkDialog } from './LoRaWanDownlinkDialog'

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
  const [showLoRaWanDownlink, setShowLoRaWanDownlink] = useState(false)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    await onPublish(topic, payload, qos, retain)
  }

  return (
    <>
      <form className="publish" onSubmit={submit}>
        <div className="publish-head">
          <h2>{t('publish.eyebrow')}</h2>
          <div className="publish-options">
            <button className="btn plain sm" type="button" onClick={() => setShowLoRaWanDownlink(true)}>
              <DownlinkIcon width={14} height={14} />
              {t('publish.lorawanDownlink')}
            </button>
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
            <label className="checkbox">
              <input
                type="checkbox"
                checked={retain}
                disabled={!connected}
                onChange={(event) => setRetain(event.target.checked)}
              />
              <span>{t('publish.retain')}</span>
            </label>
          </div>
        </div>
        <div className="publish-body">
          <input
            className="mono"
            aria-label={t('publish.topic')}
            value={topic}
            disabled={!connected}
            placeholder={t('publish.topicPlaceholder')}
            spellCheck={false}
            onChange={(event) => setTopic(event.target.value)}
          />
          <textarea
            className="mono"
            aria-label={t('publish.payload')}
            value={payload}
            disabled={!connected}
            placeholder={t('publish.payloadPlaceholder')}
            spellCheck={false}
            onChange={(event) => setPayload(event.target.value)}
          />
          <button className="btn primary" type="submit" disabled={!connected || !topic.trim()}>
            <SendIcon width={16} height={16} />
            {t('publish.action')}
          </button>
        </div>
      </form>
      {showLoRaWanDownlink && (
        <LoRaWanDownlinkDialog
          connected={connected}
          onPublish={onPublish}
          onClose={() => setShowLoRaWanDownlink(false)}
        />
      )}
    </>
  )
}
