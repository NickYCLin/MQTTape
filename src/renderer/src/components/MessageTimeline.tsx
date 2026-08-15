import { useState } from 'react'
import type { MqttMessageRecord } from '../../../shared/contracts'
import { formatBytes, isProbablyBinaryText } from '../../../shared/message'
import { ChevronIcon } from './icons'
import { PayloadInspector } from './PayloadInspector'

interface MessageTimelineProps {
  messages: MqttMessageRecord[]
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  }).format(new Date(timestamp))
}

export function MessageTimeline({ messages }: MessageTimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string): void => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (messages.length === 0) {
    return (
      <div className="timeline-empty">
        <div className="signal-visual" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <h3>Waiting for MQTT traffic</h3>
        <p>Connect to a broker and subscribe to a topic. Messages will appear here live.</p>
      </div>
    )
  }

  return (
    <div className="message-list" role="log" aria-live="polite">
      {messages.map((message) => {
        const isExpanded = expanded.has(message.id)
        return (
          <article
            className={`message-row ${message.direction} ${isExpanded ? 'expanded' : ''}`}
            key={message.id}
          >
            <button className="message-summary" type="button" onClick={() => toggle(message.id)}>
              <span className="direction-marker">{message.direction === 'incoming' ? 'IN' : 'OUT'}</span>
              <time>{formatTime(message.timestamp)}</time>
              <span className="message-topic" title={message.topic}>{message.topic}</span>
              <span className="payload-preview">
                {isProbablyBinaryText(message.payloadText) ? '<binary payload>' : message.payloadText || '∅'}
              </span>
              <span className="message-meta">Q{message.qos}</span>
              {message.retain && <span className="message-meta retained">R</span>}
              <span className="message-size">{formatBytes(message.size)}</span>
              <ChevronIcon className="chevron" width={15} height={15} />
            </button>
            {isExpanded && (
              <div className="message-detail">
                <div className="detail-meta">
                  <span>Topic <strong>{message.topic}</strong></span>
                  <span>QoS <strong>{message.qos}</strong></span>
                  <span>Retained <strong>{message.retain ? 'yes' : 'no'}</strong></span>
                  <span>Duplicate <strong>{message.duplicate ? 'yes' : 'no'}</strong></span>
                </div>
                <PayloadInspector message={message} />
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
