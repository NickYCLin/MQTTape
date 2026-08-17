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
    <li className="tree-branch">
      <button
        className="tree-node"
        type="button"
        disabled={!node.topic}
        title={node.topic || t('topics.leadingSlashTitle')}
        onClick={() => onInspectTopic(node.topic)}
      >
        <span className="tree-row">
          <span className="tree-segment mono">{segment}</span>
          <span className="tree-counts">
            <span className="tag in">{node.incomingCount} IN</span>
            <span className="tag out">{node.outgoingCount} OUT</span>
            {node.retainedMessage && <span className="tag accent">{t('topics.retainedBadge')}</span>}
          </span>
          <strong className="tree-total mono">{formatNumber(node.totalCount)}</strong>
        </span>
        <span className="tree-preview">
          <span className="mono">{node.latestMessage.payloadText || t('common.emptyPayload')}</span>
          <time className="mono">{formatTime(node.latestMessage.timestamp)}</time>
        </span>
      </button>
      {node.children.length > 0 && (
        <ul className="tree-children">
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
      <div className="empty">
        <div className="empty-glyph" aria-hidden="true">/#</div>
        <h3>{t('topics.emptyTitle')}</h3>
        <p>{t('topics.emptyHelp')}</p>
      </div>
    )
  }

  return (
    <div className="topics">
      <section className="topics-pane" aria-labelledby="topic-tree-title">
        <div className="pane-head">
          <h3 id="topic-tree-title">{t('topics.observed')}</h3>
          <span className="badge">{t('topics.count', { count: formatNumber(tree.uniqueTopics) })}</span>
        </div>
        {visibleRoots.length > 0 ? (
          <ul className="tree">
            {visibleRoots.map((root, index) => (
              <TopicBranch key={`${root.segment}-${index}`} node={root} onInspectTopic={onInspectTopic} />
            ))}
          </ul>
        ) : (
          <div className="placeholder">{t('topics.noMatch', { query })}</div>
        )}
      </section>

      <aside className="retained-pane" aria-labelledby="retained-title">
        <div className="pane-head">
          <h3 id="retained-title">{t('topics.retainedValues')}</h3>
          <span className="badge">{formatNumber(retainedSnapshots.length)}</span>
        </div>
        <p className="hint">{t('topics.retainedHelp')}</p>
        <div className="retained-list">
          {retainedSnapshots.map(({ topic, message }) => (
            <button
              className="retained-card"
              type="button"
              key={topic}
              onClick={() => onInspectTopic(topic)}
            >
              <strong className="mono">{topic}</strong>
              <span className="mono">{message.payloadText || t('common.emptyPayload')}</span>
              <small>QoS {message.qos} · {formatBytes(message.size)} · {formatTime(message.timestamp)}</small>
            </button>
          ))}
          {retainedSnapshots.length === 0 && (
            <div className="placeholder">{t('topics.noRetained')}</div>
          )}
        </div>
      </aside>
    </div>
  )
}
