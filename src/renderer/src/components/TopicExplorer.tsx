import { useMemo } from 'react'
import type { MqttMessageRecord } from '../../../shared/contracts'
import { formatBytes } from '../../../shared/message'
import {
  buildTopicTree,
  filterTopicTree,
  type TopicTreeNode
} from '../../../shared/topic-tree'
import { useI18n } from '../i18n'

interface TopicExplorerProps {
  messages: MqttMessageRecord[]
  query: string
  onInspectTopic: (topic: string) => void
}

function TopicBranch({
  node,
  onInspectTopic
}: {
  node: TopicTreeNode
  onInspectTopic: (topic: string) => void
}) {
  const { t, formatNumber, formatTime } = useI18n()
  const segment = node.segment || t(node.topic ? 'topics.emptyLevel' : 'topics.leadingSlash')
  return (
    <li className="topic-branch">
      <button
        className="topic-node"
        type="button"
        disabled={!node.topic}
        title={node.topic || t('topics.leadingSlashTitle')}
        onClick={() => onInspectTopic(node.topic)}
      >
        <span className="topic-segment">{segment}</span>
        <span className="topic-direction-counts">
          <i className="incoming-count">{node.incomingCount} IN</i>
          <i className="outgoing-count">{node.outgoingCount} OUT</i>
        </span>
        {node.retainedMessage && <span className="retained-badge">{t('topics.retainedBadge')}</span>}
        <strong>{formatNumber(node.totalCount)}</strong>
      </button>
      <div className="topic-node-preview">
        <span>{node.latestMessage.payloadText || t('common.emptyPayload')}</span>
        <time>{formatTime(node.latestMessage.timestamp)}</time>
      </div>
      {node.children.length > 0 && (
        <ul className="topic-children">
          {node.children.map((child) => (
            <TopicBranch key={`${node.topic}/${child.segment}`} node={child} onInspectTopic={onInspectTopic} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function TopicExplorer({ messages, query, onInspectTopic }: TopicExplorerProps) {
  const { t, formatNumber, formatTime } = useI18n()
  const tree = useMemo(() => buildTopicTree(messages), [messages])
  const visibleRoots = useMemo(() => filterTopicTree(tree.roots, query), [query, tree.roots])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const retainedSnapshots = useMemo(
    () => tree.retainedSnapshots.filter(({ topic, message }) =>
      !normalizedQuery || `${topic}\n${message.payloadText}`.toLocaleLowerCase().includes(normalizedQuery)
    ),
    [normalizedQuery, tree.retainedSnapshots]
  )

  if (messages.length === 0) {
    return (
      <div className="timeline-empty">
        <div className="topic-empty-icon" aria-hidden="true">/#</div>
        <h3>{t('topics.emptyTitle')}</h3>
        <p>{t('topics.emptyHelp')}</p>
      </div>
    )
  }

  return (
    <div className="topic-explorer">
      <section className="topic-tree-pane" aria-labelledby="topic-tree-title">
        <div className="topic-pane-heading">
          <div>
            <span className="eyebrow">{t('topics.sessionDerived')}</span>
            <h3 id="topic-tree-title">{t('topics.observed')}</h3>
          </div>
          <span className="counter-badge">{t('topics.count', { count: formatNumber(tree.uniqueTopics) })}</span>
        </div>
        {visibleRoots.length > 0 ? (
          <ul className="topic-tree">
            {visibleRoots.map((root, index) => (
              <TopicBranch key={`${root.segment}-${index}`} node={root} onInspectTopic={onInspectTopic} />
            ))}
          </ul>
        ) : (
          <div className="topic-pane-empty">{t('topics.noMatch', { query })}</div>
        )}
      </section>

      <aside className="retained-pane" aria-labelledby="retained-title">
        <div className="topic-pane-heading">
          <div>
            <span className="eyebrow">{t('topics.snapshot')}</span>
            <h3 id="retained-title">{t('topics.retainedValues')}</h3>
          </div>
          <span className="counter-badge">{formatNumber(retainedSnapshots.length)}</span>
        </div>
        <p className="retained-note">
          {t('topics.retainedHelp')}
        </p>
        <div className="retained-list">
          {retainedSnapshots.map(({ topic, message }) => (
            <button
              className="retained-card"
              type="button"
              key={topic}
              onClick={() => onInspectTopic(topic)}
            >
              <strong>{topic}</strong>
              <span>{message.payloadText || t('common.emptyPayload')}</span>
              <small>QoS {message.qos} · {formatBytes(message.size)} · {formatTime(message.timestamp)}</small>
            </button>
          ))}
          {retainedSnapshots.length === 0 && (
            <div className="retained-empty">{t('topics.noRetained')}</div>
          )}
        </div>
      </aside>
    </div>
  )
}
