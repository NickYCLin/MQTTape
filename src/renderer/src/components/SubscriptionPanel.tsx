import { useState, type FormEvent } from 'react'
import type { MqttQos } from '../../../shared/contracts'
import { XIcon } from './icons'
import { useI18n } from '../i18n'

interface SubscriptionPanelProps {
  connected: boolean
  subscriptions: Map<string, MqttQos>
  onSubscribe: (topic: string, qos: MqttQos) => Promise<boolean>
  onUnsubscribe: (topic: string) => void
}

export function SubscriptionPanel({
  connected,
  subscriptions,
  onSubscribe,
  onUnsubscribe
}: SubscriptionPanelProps) {
  const { t } = useI18n()
  const [topic, setTopic] = useState('#')
  const [qos, setQos] = useState<MqttQos>(0)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (await onSubscribe(topic, qos)) setTopic('')
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('subscriptions.title')}</h2>
        <span className="badge">{subscriptions.size}</span>
      </div>

      <div className="panel-body">
        <form className="subscribe-row" onSubmit={submit}>
          <input
            className="mono"
            aria-label={t('subscriptions.topic')}
            value={topic}
            disabled={!connected}
            placeholder="sensors/#"
            spellCheck={false}
            onChange={(event) => setTopic(event.target.value)}
          />
          <select
            aria-label={t('subscriptions.qos')}
            value={qos}
            disabled={!connected}
            onChange={(event) => setQos(Number(event.target.value) as MqttQos)}
          >
            <option value={0}>QoS 0</option>
            <option value={1}>QoS 1</option>
            <option value={2}>QoS 2</option>
          </select>
          <button className="btn primary" type="submit" disabled={!connected || !topic.trim()}>
            {t('subscriptions.add')}
          </button>
        </form>

        {subscriptions.size === 0 ? (
          <p className="hint centered">{t('subscriptions.empty')}</p>
        ) : (
          <ul className="subscribe-list">
            {[...subscriptions.entries()].map(([subscription, subscriptionQos]) => (
              <li className="subscribe-item" key={subscription}>
                <span className="mono" title={subscription}>{subscription}</span>
                <span className="tag">QoS {subscriptionQos}</span>
                <button
                  className="btn plain icon sm"
                  type="button"
                  aria-label={t('subscriptions.unsubscribe', { topic: subscription })}
                  onClick={() => onUnsubscribe(subscription)}
                >
                  <XIcon width={14} height={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
