import { describe, expect, it } from 'vitest'
import type { MqttMessageRecord } from './contracts'
import { buildTopicTree, filterTopicTree } from './topic-tree'

function message(
  id: string,
  topic: string,
  timestamp: string,
  overrides: Partial<MqttMessageRecord> = {}
): MqttMessageRecord {
  return {
    id,
    direction: 'incoming',
    timestamp,
    topic,
    qos: 0,
    retain: false,
    duplicate: false,
    payloadBase64: '',
    payloadText: id,
    size: id.length,
    ...overrides
  }
}

describe('topic tree', () => {
  it('builds hierarchy and aggregates direction counts in timestamp order', () => {
    const tree = buildTopicTree([
      message('new', 'factory/line-2/state', '2026-01-01T00:00:03.000Z'),
      message('old', 'factory/line-2/state', '2026-01-01T00:00:01.000Z', {
        direction: 'outgoing'
      }),
      message('temperature', 'factory/line-10/temperature', '2026-01-01T00:00:02.000Z')
    ])

    const factory = tree.roots[0]
    const line2 = factory.children[0]
    const state = line2.children[0]

    expect(tree.uniqueTopics).toBe(2)
    expect(factory.totalCount).toBe(3)
    expect(factory.incomingCount).toBe(2)
    expect(factory.outgoingCount).toBe(1)
    expect(line2.segment).toBe('line-2')
    expect(factory.children[1].segment).toBe('line-10')
    expect(state.directCount).toBe(2)
    expect(state.latestMessage.id).toBe('new')
  })

  it('keeps the latest retained value and removes it after an empty tombstone', () => {
    const retained = message('retained', 'devices/lamp/state', '2026-01-01T00:00:01.000Z', {
      retain: true
    })
    const live = message('live', 'devices/lamp/state', '2026-01-01T00:00:02.000Z')
    const beforeClear = buildTopicTree([live, retained])
    const tombstone = message('clear', 'devices/lamp/state', '2026-01-01T00:00:03.000Z', {
      retain: true,
      payloadText: '',
      size: 0
    })

    expect(beforeClear.retainedSnapshots.map(({ message }) => message.id)).toEqual(['retained'])
    expect(buildTopicTree([retained, live, tombstone]).retainedSnapshots).toEqual([])
  })

  it('filters branches by topic or latest payload while retaining ancestors', () => {
    const tree = buildTopicTree([
      message('21.5', 'factory/temperature', '2026-01-01T00:00:01.000Z'),
      message('online', 'factory/status', '2026-01-01T00:00:02.000Z')
    ])

    const filtered = filterTopicTree(tree.roots, '21.5')

    expect(filtered).toHaveLength(1)
    expect(filtered[0].children.map(({ segment }) => segment)).toEqual(['temperature'])
  })

  it('preserves empty topic levels such as a leading slash', () => {
    const tree = buildTopicTree([
      message('rooted', '/factory/status', '2026-01-01T00:00:01.000Z')
    ])

    expect(tree.roots[0].segment).toBe('')
    expect(tree.roots[0].topic).toBe('')
    expect(tree.roots[0].children[0].topic).toBe('/factory')
    expect(tree.roots[0].children[0].children[0].topic).toBe('/factory/status')
  })
})
