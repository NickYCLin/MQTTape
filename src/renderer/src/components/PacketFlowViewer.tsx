import type {
  MqttPacketCommand,
  MqttPacketFlowRecord,
  MqttPacketFlowState
} from '../../../shared/contracts'
import {
  filterMqttPacketFlows,
  nextExpectedPacketCommand,
  packetFlowDurationMilliseconds
} from '../../../shared/packet-flow'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../lib/i18n'

interface PacketFlowViewerProps {
  flows: MqttPacketFlowRecord[]
  query: string
}

const stateKeys: Record<MqttPacketFlowState, TranslationKey> = {
  pending: 'packetFlow.state.pending',
  completed: 'packetFlow.state.completed',
  failed: 'packetFlow.state.failed'
}

const reasonKeys: Partial<Record<number, TranslationKey>> = {
  0x00: 'packetFlow.reason.success',
  0x10: 'packetFlow.reason.noSubscribers',
  0x80: 'packetFlow.reason.unspecifiedError',
  0x87: 'packetFlow.reason.notAuthorized',
  0x90: 'packetFlow.reason.topicNameInvalid',
  0x91: 'packetFlow.reason.packetIdentifierInUse',
  0x92: 'packetFlow.reason.packetIdentifierNotFound',
  0x95: 'packetFlow.reason.packetTooLarge',
  0x97: 'packetFlow.reason.quotaExceeded',
  0x99: 'packetFlow.reason.payloadFormatInvalid',
  0x9a: 'packetFlow.reason.retainNotSupported',
  0x9b: 'packetFlow.reason.qosNotSupported'
}

function packetName(command: MqttPacketCommand): string {
  return command.toUpperCase()
}

function formatReasonCode(reasonCode: number): string {
  return `0x${reasonCode.toString(16).padStart(2, '0').toUpperCase()}`
}

export function PacketFlowViewer({ flows, query }: PacketFlowViewerProps) {
  const { t, formatNumber, formatTime } = useI18n()
  const directlyMatchingIds = new Set(filterMqttPacketFlows(flows, query).map(({ id }) => id))
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleFlows = normalizedQuery
    ? flows.filter((flow) => directlyMatchingIds.has(flow.id) || [
      t(stateKeys[flow.state]),
      t(flow.messageDirection === 'incoming' ? 'common.incoming' : 'common.outgoing')
    ].some((label) => label.toLocaleLowerCase().includes(normalizedQuery)))
    : flows
  const completed = flows.filter(({ state }) => state === 'completed').length
  const pending = flows.filter(({ state }) => state === 'pending').length
  const failed = flows.filter(({ state }) => state === 'failed').length

  if (flows.length === 0) {
    return (
      <div className="empty packet-flow-empty">
        <div className="packet-flow-glyph" aria-hidden="true">
          <i>TX</i><span>→</span><i>RX</i>
        </div>
        <h3>{t('packetFlow.emptyTitle')}</h3>
        <p>{t('packetFlow.emptyHelp')}</p>
      </div>
    )
  }

  return (
    <section className="packet-flow-viewer" aria-labelledby="packet-flow-title">
      <header className="packet-flow-head">
        <div>
          <span className="eyebrow">{t('packetFlow.eyebrow')}</span>
          <h3 id="packet-flow-title">{t('packetFlow.title')}</h3>
          <p>{t('packetFlow.help')}</p>
          <small>{t('packetFlow.privacy')}</small>
        </div>
        <div className="packet-flow-summary" aria-label={t('packetFlow.summary')}>
          <span className="tag">{t('packetFlow.total', { count: formatNumber(flows.length) })}</span>
          <span className="tag pending">{t('packetFlow.pendingCount', { count: formatNumber(pending) })}</span>
          <span className="tag completed">{t('packetFlow.completedCount', { count: formatNumber(completed) })}</span>
          <span className="tag failed">{t('packetFlow.failedCount', { count: formatNumber(failed) })}</span>
        </div>
      </header>

      <div className="packet-flow-legend" role="note">
        <span><i className="tx">TX</i>{t('packetFlow.sent')}</span>
        <span><i className="rx">RX</i>{t('packetFlow.received')}</span>
        <span>{t('packetFlow.qosGuide')}</span>
      </div>

      {visibleFlows.length === 0 ? (
        <div className="packet-flow-no-match">
          <strong>{t('packetFlow.noMatch', { query })}</strong>
          <span>{t('packetFlow.noMatchHelp')}</span>
        </div>
      ) : (
        <div className="packet-flow-list">
          {visibleFlows.map((flow) => {
            const duration = packetFlowDurationMilliseconds(flow)
            const nextCommand = nextExpectedPacketCommand(flow)
            return (
              <article className={`packet-flow state-${flow.state}`} key={flow.id}>
                <header className="packet-flow-card-head">
                  <span className={`dir ${flow.messageDirection}`}>
                    {flow.messageDirection === 'incoming' ? 'IN' : 'OUT'}
                  </span>
                  <div className="packet-flow-identity">
                    <strong className="mono" title={flow.topic}>{flow.topic || t('common.unknown')}</strong>
                    <span>
                      QoS {flow.qos}
                      {flow.messageId !== undefined
                        ? ` · ${t('packetFlow.packetIdentifier')} ${formatNumber(flow.messageId)}`
                        : ''}
                      {` · ${formatTime(flow.startedAt, true)}`}
                    </span>
                  </div>
                  <div className="packet-flow-result">
                    <span className={`packet-flow-state state-${flow.state}`}>
                      {t(stateKeys[flow.state])}
                    </span>
                    {flow.completedAt && (
                      <small>{t('packetFlow.duration', { count: formatNumber(duration) })}</small>
                    )}
                  </div>
                </header>

                <ol className="packet-flow-steps" aria-label={t('packetFlow.steps')}>
                  {flow.steps.map((step, index) => {
                    const elapsed = Math.max(0, Date.parse(step.timestamp) - Date.parse(flow.startedAt))
                    const reasonKey = step.reasonCode === undefined
                      ? undefined
                      : reasonKeys[step.reasonCode]
                    return (
                      <li className={step.direction} key={step.id}>
                        <span className="packet-flow-line" aria-hidden="true" />
                        <i className={step.direction === 'sent' ? 'tx' : 'rx'}>
                          {step.direction === 'sent' ? 'TX' : 'RX'}
                        </i>
                        <strong>{packetName(step.command)}</strong>
                        {step.duplicate && <span className="tag warn">DUP</span>}
                        {step.reasonCode !== undefined && (
                          <span className={`packet-reason ${step.reasonCode >= 0x80 ? 'failed' : ''}`}>
                            {t('packetFlow.reasonCode')} {formatReasonCode(step.reasonCode)}
                            {reasonKey ? ` · ${t(reasonKey)}` : ''}
                          </span>
                        )}
                        <time title={step.timestamp}>
                          {index === 0
                            ? t('packetFlow.started')
                            : t('packetFlow.elapsed', { count: formatNumber(elapsed) })}
                        </time>
                      </li>
                    )
                  })}
                  {nextCommand && (
                    <li className="expected">
                      <span className="packet-flow-line" aria-hidden="true" />
                      <i>…</i>
                      <strong>{t('packetFlow.awaiting', { packet: packetName(nextCommand) })}</strong>
                    </li>
                  )}
                </ol>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
