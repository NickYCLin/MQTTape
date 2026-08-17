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
      <div className="empty">
        <div className="signal" aria-hidden="true">
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
    <div className="timeline" role="log" aria-live="polite">
      {messages.map((message) => {
        const isExpanded = expanded.has(message.id)
        return (
          <article
            className={`msg ${message.direction} ${isExpanded ? 'expanded' : ''}`}
            key={message.id}
          >
            <button className="msg-summary" type="button" onClick={() => toggle(message.id)}>
              <span className="dir">{message.direction === 'incoming' ? 'IN' : 'OUT'}</span>
              <time className="msg-time">{formatTime(message.timestamp, true)}</time>
              <span className="msg-topic" title={message.topic}>{message.topic}</span>
              <span className="msg-preview">
                {isProbablyBinaryText(message.payloadText) ? t('timeline.binaryPayload') : message.payloadText || '∅'}
              </span>
              <span className="msg-flags">
                <span className="tag">Q{message.qos}</span>
                {message.retain && <span className="tag accent">R</span>}
              </span>
              <span className="msg-size">{formatBytes(message.size)}</span>
              <ChevronIcon className="chevron" width={16} height={16} />
            </button>
            {isExpanded && (
              <div className="msg-detail">
                <dl className="detail-meta">
                  <div><dt>{t('common.topic')}</dt><dd className="mono">{message.topic}</dd></div>
                  <div><dt>QoS</dt><dd className="mono">{message.qos}</dd></div>
                  <div><dt>{t('common.retained')}</dt><dd className="mono">{t(message.retain ? 'common.yes' : 'common.no')}</dd></div>
                  <div><dt>{t('common.duplicate')}</dt><dd className="mono">{t(message.duplicate ? 'common.yes' : 'common.no')}</dd></div>
                </dl>
                <PayloadInspector message={message} />
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
