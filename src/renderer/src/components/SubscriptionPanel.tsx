import { useState, type FormEvent } from 'react'
import type { MqttQos } from '../../../shared/contracts'
import { XIcon } from './icons'

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
  const [topic, setTopic] = useState('#')
  const [qos, setQos] = useState<MqttQos>(0)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (await onSubscribe(topic, qos)) setTopic('')
  }

  return (
    <section className="panel subscription-panel">
      <div className="panel-heading compact-heading">
        <div>
          <span className="eyebrow">TOPICS</span>
          <h2>Subscriptions</h2>
        </div>
        <span className="counter-badge">{subscriptions.size}</span>
      </div>

      <form className="subscription-form" onSubmit={submit}>
        <input
          aria-label="Subscription topic"
          value={topic}
          disabled={!connected}
          placeholder="sensors/#"
          spellCheck={false}
          onChange={(event) => setTopic(event.target.value)}
        />
        <select
          aria-label="Subscription QoS"
          value={qos}
          disabled={!connected}
          onChange={(event) => setQos(Number(event.target.value) as MqttQos)}
        >
          <option value={0}>QoS 0</option>
          <option value={1}>QoS 1</option>
          <option value={2}>QoS 2</option>
        </select>
        <button type="submit" disabled={!connected || !topic.trim()}>
          Add
        </button>
      </form>

      <div className="subscription-list">
        {subscriptions.size === 0 ? (
          <p className="empty-hint">No active subscriptions</p>
        ) : (
          [...subscriptions.entries()].map(([subscription, subscriptionQos]) => (
            <div className="subscription-item" key={subscription}>
              <span title={subscription}>{subscription}</span>
              <small>Q{subscriptionQos}</small>
              <button
                type="button"
                aria-label={`Unsubscribe ${subscription}`}
                onClick={() => onUnsubscribe(subscription)}
              >
                <XIcon width={14} height={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
