import type { MqttMessageRecord } from './contracts'

export interface TopicTreeNode {
  segment: string
  topic: string
  directCount: number
  totalCount: number
  incomingCount: number
  outgoingCount: number
  latestMessage: MqttMessageRecord
  retainedMessage?: MqttMessageRecord
  children: TopicTreeNode[]
}

export interface RetainedTopicSnapshot {
  topic: string
  message: MqttMessageRecord
}

export interface TopicTreeResult {
  roots: TopicTreeNode[]
  uniqueTopics: number
  retainedSnapshots: RetainedTopicSnapshot[]
}

interface MutableTopicNode extends Omit<TopicTreeNode, 'children'> {
  children: Map<string, MutableTopicNode>
}

function messageTime(message: MqttMessageRecord): number {
  const value = Date.parse(message.timestamp)
  return Number.isFinite(value) ? value : 0
}

function orderedMessages(messages: MqttMessageRecord[]): MqttMessageRecord[] {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((left, right) => {
      const difference = messageTime(left.message) - messageTime(right.message)
      return difference || left.index - right.index
    })
    .map(({ message }) => message)
}

function toTopicTreeNode(node: MutableTopicNode): TopicTreeNode {
  return {
    ...node,
    children: [...node.children.values()]
      .sort((left, right) => left.segment.localeCompare(
        right.segment,
        undefined,
        { numeric: true, sensitivity: 'base' }
      ))
      .map(toTopicTreeNode)
  }
}

export function buildTopicTree(messages: MqttMessageRecord[]): TopicTreeResult {
  const roots = new Map<string, MutableTopicNode>()
  const leaves = new Map<string, MutableTopicNode>()
  const retained = new Map<string, MqttMessageRecord>()

  for (const message of orderedMessages(messages)) {
    let siblings = roots
    let leaf: MutableTopicNode | undefined

    const segments = message.topic.split('/')
    for (const [index, segment] of segments.entries()) {
      const topic = segments.slice(0, index + 1).join('/')
      let node = siblings.get(segment)
      if (!node) {
        node = {
          segment,
          topic,
          directCount: 0,
          totalCount: 0,
          incomingCount: 0,
          outgoingCount: 0,
          latestMessage: message,
          children: new Map()
        }
        siblings.set(segment, node)
      }

      node.totalCount += 1
      if (message.direction === 'incoming') node.incomingCount += 1
      else node.outgoingCount += 1
      node.latestMessage = message
      leaf = node
      siblings = node.children
    }

    if (!leaf) continue
    leaf.directCount += 1
    leaves.set(message.topic, leaf)

    if (message.retain) {
      if (message.size === 0) retained.delete(message.topic)
      else retained.set(message.topic, message)
    }
  }

  for (const [topic, message] of retained) {
    const leaf = leaves.get(topic)
    if (leaf) leaf.retainedMessage = message
  }

  return {
    roots: [...roots.values()]
      .sort((left, right) => left.segment.localeCompare(
        right.segment,
        undefined,
        { numeric: true, sensitivity: 'base' }
      ))
      .map(toTopicTreeNode),
    uniqueTopics: leaves.size,
    retainedSnapshots: [...retained.entries()]
      .sort(([left], [right]) => left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: 'base'
      }))
      .map(([topic, message]) => ({ topic, message }))
  }
}

export function filterTopicTree(nodes: TopicTreeNode[], query: string): TopicTreeNode[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return nodes

  return nodes.flatMap((node) => {
    const children = filterTopicTree(node.children, normalized)
    const matches = `${node.topic}\n${node.latestMessage.payloadText}`
      .toLocaleLowerCase()
      .includes(normalized)
    return matches || children.length > 0 ? [{ ...node, children }] : []
  })
}
