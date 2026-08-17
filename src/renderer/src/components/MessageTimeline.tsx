import { useState } from 'react'
import type { MqttMessageRecord } from '../../../shared/contracts'
import { formatBytes, isProbablyBinaryText } from '../../../shared/message'
import { ChevronIcon } from './icons'
import { PayloadInspector } from './PayloadInspector'
import { useI18n } from '../i18n'

interface MessageTimelineProps {
  messages: MqttMessageRecord[]
}

export function MessageTimeline({ messages }: MessageTimelineProps) {
  const { t, formatTime } = useI18n()
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
        <h3>{t('timeline.waiting')}</h3>
        <p>{t('timeline.waitingHelp')}</p>
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
              <time>{formatTime(message.timestamp, true)}</time>
              <span className="message-topic" title={message.topic}>{message.topic}</span>
              <span className="payload-preview">
                {isProbablyBinaryText(message.payloadText) ? t('timeline.binaryPayload') : message.payloadText || '∅'}
              </span>
              <span className="message-meta">Q{message.qos}</span>
              {message.retain && <span className="message-meta retained">R</span>}
              <span className="message-size">{formatBytes(message.size)}</span>
              <ChevronIcon className="chevron" width={15} height={15} />
            </button>
            {isExpanded && (
              <div className="message-detail">
                <div className="detail-meta">
                  <span>{t('common.topic')} <strong>{message.topic}</strong></span>
                  <span>QoS <strong>{message.qos}</strong></span>
                  <span>{t('common.retained')} <strong>{t(message.retain ? 'common.yes' : 'common.no')}</strong></span>
                  <span>{t('common.duplicate')} <strong>{t(message.duplicate ? 'common.yes' : 'common.no')}</strong></span>
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
