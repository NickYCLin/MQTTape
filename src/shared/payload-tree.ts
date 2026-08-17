export type PayloadTreeNodeKind =
  | 'null'
  | 'undefined'
  | 'string'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'date'
  | 'binary'
  | 'array'
  | 'object'
  | 'map'
  | 'set'
  | 'tag'
  | 'reference'
  | 'unsupported'

export interface PayloadTreeEntry {
  key: string
  node: PayloadTreeNode
}

export interface PayloadTreeNode {
  kind: PayloadTreeNodeKind
  value?: string
  typeName?: string
  byteLength?: number
  children?: PayloadTreeEntry[]
  totalChildren?: number
  truncated?: boolean
}

const MAX_TREE_DEPTH = 32
const MAX_TREE_NODES = 5_000
const MAX_COLLECTION_CHILDREN = 200
const MAX_STRING_CHARACTERS = 4_096
const MAX_BINARY_PREVIEW_BYTES = 64

interface NormalizationState {
  nodes: number
  ancestors: WeakSet<object>
}

function displayString(value: string): { value: string; truncated: boolean } {
  if (value.length <= MAX_STRING_CHARACTERS) return { value, truncated: false }
  return {
    value: `${value.slice(0, MAX_STRING_CHARACTERS)}…`,
    truncated: true
  }
}

function binaryBytes(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  return undefined
}

function binaryPreview(bytes: Uint8Array): string {
  const visible = bytes.subarray(0, MAX_BINARY_PREVIEW_BYTES)
  const hexadecimal = [...visible]
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ')
  return visible.byteLength < bytes.byteLength ? `${hexadecimal} …` : hexadecimal
}

function mapKey(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return `${value.toString()}n`
  if (value === null) return 'null'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return Object.prototype.toString.call(value)
    }
  }
  return String(value)
}

function collectionNode(
  kind: 'array' | 'object' | 'map' | 'set' | 'tag',
  entries: Array<[string, unknown]>,
  depth: number,
  state: NormalizationState,
  typeName?: string
): PayloadTreeNode {
  const visibleEntries = entries.slice(0, MAX_COLLECTION_CHILDREN)
  const children = visibleEntries.map(([key, value]) => ({
    key,
    node: normalizeValue(value, depth + 1, state)
  }))
  return {
    kind,
    ...(typeName ? { typeName } : {}),
    children,
    totalChildren: entries.length,
    truncated: visibleEntries.length < entries.length
  }
}

function normalizeObject(
  value: object,
  depth: number,
  state: NormalizationState
): PayloadTreeNode {
  const bytes = binaryBytes(value)
  if (bytes) {
    return {
      kind: 'binary',
      value: binaryPreview(bytes),
      typeName: value.constructor?.name,
      byteLength: bytes.byteLength,
      truncated: bytes.byteLength > MAX_BINARY_PREVIEW_BYTES
    }
  }
  if (value instanceof Date) {
    return {
      kind: 'date',
      value: Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
    }
  }
  if (state.ancestors.has(value)) return { kind: 'reference', value: '[Circular]' }
  if (depth >= MAX_TREE_DEPTH) return { kind: 'unsupported', value: '[Maximum depth reached]' }

  state.ancestors.add(value)
  let node: PayloadTreeNode
  if (Array.isArray(value)) {
    node = collectionNode(
      'array',
      value.map((item, index) => [String(index), item]),
      depth,
      state
    )
  } else if (value instanceof Map) {
    node = collectionNode(
      'map',
      [...value.entries()].map(([key, item]) => [mapKey(key), item]),
      depth,
      state,
      value.constructor.name
    )
  } else if (value instanceof Set) {
    node = collectionNode(
      'set',
      [...value].map((item, index) => [String(index), item]),
      depth,
      state,
      value.constructor.name
    )
  } else {
    const typeName = value.constructor?.name
    const kind = typeName === 'Tag' ? 'tag' : 'object'
    node = collectionNode(
      kind,
      Object.entries(value),
      depth,
      state,
      typeName && typeName !== 'Object' ? typeName : undefined
    )
  }
  state.ancestors.delete(value)
  return node
}

function normalizeValue(
  value: unknown,
  depth: number,
  state: NormalizationState
): PayloadTreeNode {
  state.nodes += 1
  if (state.nodes > MAX_TREE_NODES) {
    return { kind: 'unsupported', value: '[Maximum node count reached]' }
  }
  if (value === null) return { kind: 'null', value: 'null' }
  if (value === undefined) return { kind: 'undefined', value: 'undefined' }
  if (typeof value === 'string') {
    const display = displayString(value)
    return { kind: 'string', value: display.value, truncated: display.truncated }
  }
  if (typeof value === 'number') return { kind: 'number', value: String(value) }
  if (typeof value === 'boolean') return { kind: 'boolean', value: String(value) }
  if (typeof value === 'bigint') return { kind: 'bigint', value: `${value.toString()}n` }
  if (typeof value === 'object') return normalizeObject(value, depth, state)
  return {
    kind: 'unsupported',
    value: String(value),
    typeName: typeof value
  }
}

export function toPayloadTree(value: unknown): PayloadTreeNode {
  return normalizeValue(value, 0, {
    nodes: 0,
    ancestors: new WeakSet<object>()
  })
}

export function isStructuredPayloadValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (value instanceof Map || value instanceof Set) return value.size > 0
  if (value instanceof Date) return true
  if (value === null || typeof value !== 'object') return false
  return binaryBytes(value) === undefined && Object.keys(value).length > 0
}
