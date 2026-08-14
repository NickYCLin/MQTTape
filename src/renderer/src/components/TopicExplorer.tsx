import { useMemo } from 'react'
import type { MqttMessageRecord } from '../../../shared/contracts'
import { formatBytes } from '../../../shared/message'
import {
  buildTopicTree,
  filterTopicTree,
  type TopicTreeNode
} from '../../../shared/topic-tree'

interface TopicExplorerProps {
  messages: MqttMessageRecord[]
  query: string
  onInspectTopic: (topic: string) => void
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(timestamp))
}

function displaySegment(node: TopicTreeNode): string {
  if (node.segment) return node.segment
  return node.topic ? '(empty level)' : '(leading slash)'
}

function TopicBranch({
  node,
  onInspectTopic
}: {
  node: TopicTreeNode
  onInspectTopic: (topic: string) => void
}) {
  return (
    <li className="topic-branch">
      <button
        className="topic-node"
        type="button"
        disabled={!node.topic}
        title={node.topic || 'Leading slash level'}
        onClick={() => onInspectTopic(node.topic)}
      >
        <span className="topic-segment">{displaySegment(node)}</span>
        <span className="topic-direction-counts">
          <i className="incoming-count">{node.incomingCount} IN</i>
          <i className="outgoing-count">{node.outgoingCount} OUT</i>
        </span>
        {node.retainedMessage && <span className="retained-badge">RETAINED</span>}
        <strong>{node.totalCount.toLocaleString()}</strong>
      </button>
      <div className="topic-node-preview">
        <span>{node.latestMessage.payloadText || '(empty payload)'}</span>
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
        <h3>No topics observed yet</h3>
        <p>Subscribe or publish to build a topic tree from traffic captured in this session.</p>
      </div>
    )
  }

  return (
    <div className="topic-explorer">
      <section className="topic-tree-pane" aria-labelledby="topic-tree-title">
        <div className="topic-pane-heading">
          <div>
            <span className="eyebrow">SESSION-DERIVED</span>
            <h3 id="topic-tree-title">Observed topics</h3>
          </div>
          <span className="counter-badge">{tree.uniqueTopics.toLocaleString()} TOPICS</span>
        </div>
        {visibleRoots.length > 0 ? (
          <ul className="topic-tree">
            {visibleRoots.map((root, index) => (
              <TopicBranch key={`${root.segment}-${index}`} node={root} onInspectTopic={onInspectTopic} />
            ))}
          </ul>
        ) : (
          <div className="topic-pane-empty">No topic or payload matches “{query}”.</div>
        )}
      </section>

      <aside className="retained-pane" aria-labelledby="retained-title">
        <div className="topic-pane-heading">
          <div>
            <span className="eyebrow">SESSION SNAPSHOT</span>
            <h3 id="retained-title">Retained values</h3>
          </div>
          <span className="counter-badge">{retainedSnapshots.length.toLocaleString()}</span>
        </div>
        <p className="retained-note">
          Latest retained values observed or published by MQTTape. This is not a broker-wide inventory.
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
              <span>{message.payloadText || '(empty payload)'}</span>
              <small>QoS {message.qos} · {formatBytes(message.size)} · {formatTime(message.timestamp)}</small>
            </button>
          ))}
          {retainedSnapshots.length === 0 && (
            <div className="retained-empty">No retained values are visible for this session.</div>
          )}
        </div>
      </aside>
    </div>
  )
}
