import { describe, expect, it } from 'vitest'
import { toPayloadTree } from './payload-tree'

describe('payload tree normalization', () => {
  it('preserves structured scalar types, maps, sets, and binary values', () => {
    const tree = toPayloadTree({
      count: 42n,
      createdAt: new Date('2026-08-17T00:00:00.000Z'),
      labels: new Set(['a', 'b']),
      lookup: new Map<unknown, unknown>([[1, new Uint8Array([0xde, 0xad])]])
    })

    expect(tree.kind).toBe('object')
    expect(tree.children?.find(({ key }) => key === 'count')?.node).toEqual({
      kind: 'bigint',
      value: '42n'
    })
    expect(tree.children?.find(({ key }) => key === 'createdAt')?.node).toEqual({
      kind: 'date',
      value: '2026-08-17T00:00:00.000Z'
    })
    expect(tree.children?.find(({ key }) => key === 'labels')?.node.kind).toBe('set')
    expect(tree.children?.find(({ key }) => key === 'lookup')?.node.children?.[0]).toEqual({
      key: '1',
      node: {
        kind: 'binary',
        value: 'DE AD',
        typeName: 'Uint8Array',
        byteLength: 2,
        truncated: false
      }
    })
  })

  it('stops circular references without losing their location', () => {
    const value: Record<string, unknown> = { name: 'root' }
    value.self = value
    const tree = toPayloadTree(value)
    expect(tree.children?.find(({ key }) => key === 'self')?.node).toEqual({
      kind: 'reference',
      value: '[Circular]'
    })
  })
})
