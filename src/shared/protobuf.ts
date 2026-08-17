import {
  Enum,
  MapField,
  Namespace,
  Root,
  Type,
  parse,
  type Field,
  type ReflectionObject
} from 'protobufjs'
import { decodePayloadBytes } from './message'
import { toPayloadTree, type PayloadTreeNode } from './payload-tree'

export const MAX_PROTOBUF_PAYLOAD_BYTES = 256 * 1024
export const MAX_PROTOBUF_SCHEMA_BYTES = 256 * 1024
export const MAX_PROTOBUF_SCHEMA_FILES = 16
export const MAX_STORED_PROTOBUF_SCHEMAS = 8
export const PROTOBUF_SCHEMA_STORAGE_KEY = 'mqttape:protobuf-schemas:v1'

const MAX_DECODE_DEPTH = 32
const MAX_DECODE_FIELDS = 5_000

export interface ProtobufSchemaFile {
  name: string
  source: string
}

export interface StoredProtobufSchema {
  id: string
  name: string
  files: ProtobufSchemaFile[]
  selectedType: string
  savedAt: string
}

export interface ParsedProtobufSchema {
  root: Root
  messageTypes: string[]
}

export type ProtobufInspectionStatus = 'decoded' | 'invalid' | 'too-large'

export interface ProtobufInspection {
  status: ProtobufInspectionStatus
  byteLength: number
  tree?: PayloadTreeNode
  value?: Record<string, unknown>
  error?: string
}

interface DecodeState {
  fields: number
}

class WireReader {
  pos = 0

  constructor(
    readonly bytes: Uint8Array,
    readonly end = bytes.byteLength
  ) {}

  ensure(length: number): void {
    if (!Number.isSafeInteger(length) || length < 0 || this.pos + length > this.end) {
      throw new Error('Unexpected end of Protobuf payload.')
    }
  }

  readVarint(): bigint {
    let value = 0n
    for (let shift = 0n; shift < 70n; shift += 7n) {
      this.ensure(1)
      const byte = this.bytes[this.pos++]
      value |= BigInt(byte & 0x7f) << shift
      if ((byte & 0x80) === 0) return value
    }
    throw new Error('Protobuf varint exceeds 10 bytes.')
  }

  readLength(): number {
    const length = this.readVarint()
    if (length > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Protobuf length exceeds the safe integer range.')
    }
    const value = Number(length)
    this.ensure(value)
    return value
  }

  readFixed32(): number {
    this.ensure(4)
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, 4)
    const value = view.getUint32(0, true)
    this.pos += 4
    return value
  }

  readFloat(): number {
    this.ensure(4)
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, 4)
    const value = view.getFloat32(0, true)
    this.pos += 4
    return value
  }

  readFixed64(): bigint {
    this.ensure(8)
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, 8)
    const value = view.getBigUint64(0, true)
    this.pos += 8
    return value
  }

  readDouble(): number {
    this.ensure(8)
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, 8)
    const value = view.getFloat64(0, true)
    this.pos += 8
    return value
  }

  readBytes(): Uint8Array {
    const length = this.readLength()
    const value = Uint8Array.from(this.bytes.subarray(this.pos, this.pos + length))
    this.pos += length
    return value
  }

  subReader(): WireReader {
    const length = this.readLength()
    const reader = new WireReader(this.bytes, this.pos + length)
    reader.pos = this.pos
    this.pos += length
    return reader
  }
}

function mediaType(contentType: string): string {
  return contentType.split(';', 1)[0].trim().toLocaleLowerCase()
}

export function isProtobufContentType(contentType?: string): boolean {
  if (!contentType) return false
  const normalized = mediaType(contentType)
  return normalized === 'application/protobuf' ||
    normalized === 'application/x-protobuf' ||
    normalized === 'application/vnd.google.protobuf' ||
    normalized.endsWith('+protobuf') ||
    normalized.endsWith('+proto')
}

function collectMessageTypes(object: ReflectionObject, result: string[]): void {
  if (object instanceof Type) result.push(object.fullName.replace(/^\./, ''))
  if (object instanceof Namespace) {
    for (const child of object.nestedArray) collectMessageTypes(child, result)
  }
}

export function parseProtobufSchema(files: ProtobufSchemaFile[]): ParsedProtobufSchema {
  if (files.length === 0) throw new Error('Select at least one .proto file.')
  if (files.length > MAX_PROTOBUF_SCHEMA_FILES) {
    throw new Error(`A schema bundle is limited to ${MAX_PROTOBUF_SCHEMA_FILES} files.`)
  }

  const root = new Root()
  for (const file of files) {
    const size = new TextEncoder().encode(file.source).byteLength
    if (!file.name.toLocaleLowerCase().endsWith('.proto')) {
      throw new Error(`Unsupported schema file: ${file.name}`)
    }
    if (size === 0) throw new Error(`Schema file is empty: ${file.name}`)
    if (size > MAX_PROTOBUF_SCHEMA_BYTES) {
      throw new Error(`Schema file exceeds 256 KB: ${file.name}`)
    }
    parse(file.source, root, { keepCase: true, alternateCommentMode: true })
  }
  root.resolveAll()

  const messageTypes: string[] = []
  collectMessageTypes(root, messageTypes)
  messageTypes.sort((left, right) => left.localeCompare(right))
  if (messageTypes.length === 0) throw new Error('Schema does not define a message type.')
  return { root, messageTypes }
}

function isSchemaFile(value: unknown): value is ProtobufSchemaFile {
  return typeof value === 'object' && value !== null &&
    typeof (value as ProtobufSchemaFile).name === 'string' &&
    typeof (value as ProtobufSchemaFile).source === 'string'
}

function isStoredSchema(value: unknown): value is StoredProtobufSchema {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as StoredProtobufSchema
  return typeof candidate.id === 'string' && candidate.id.length > 0 &&
    typeof candidate.name === 'string' && candidate.name.length > 0 &&
    Array.isArray(candidate.files) && candidate.files.length > 0 &&
    candidate.files.length <= MAX_PROTOBUF_SCHEMA_FILES && candidate.files.every(isSchemaFile) &&
    typeof candidate.selectedType === 'string' &&
    typeof candidate.savedAt === 'string'
}

export function readProtobufSchemas(storage: Pick<Storage, 'getItem'>): StoredProtobufSchema[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PROTOBUF_SCHEMA_STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStoredSchema).slice(0, MAX_STORED_PROTOBUF_SCHEMAS)
  } catch {
    return []
  }
}

export function writeProtobufSchemas(
  storage: Pick<Storage, 'setItem'>,
  schemas: StoredProtobufSchema[]
): void {
  if (schemas.length > MAX_STORED_PROTOBUF_SCHEMAS || !schemas.every(isStoredSchema)) {
    throw new Error('Invalid Protobuf schema collection.')
  }
  storage.setItem(PROTOBUF_SCHEMA_STORAGE_KEY, JSON.stringify(schemas))
}

function enumValue(type: Enum, numericValue: number): string | number {
  const name = type.valuesById[numericValue]
  return name === undefined ? numericValue : `${name} (${numericValue})`
}

function zigZag(value: bigint): bigint {
  return (value >> 1n) ^ -(value & 1n)
}

const packableTypes = new Set([
  'double', 'float', 'int32', 'uint32', 'sint32', 'fixed32', 'sfixed32',
  'int64', 'uint64', 'sint64', 'fixed64', 'sfixed64', 'bool'
])

function expectedWireType(type: string, resolvedType: Type | Enum | null): number {
  if (resolvedType instanceof Type || type === 'string' || type === 'bytes') return 2
  if (type === 'fixed64' || type === 'sfixed64' || type === 'double') return 1
  if (type === 'fixed32' || type === 'sfixed32' || type === 'float') return 5
  return 0
}

function decodeValue(
  type: string,
  resolvedType: Type | Enum | null,
  wireType: number,
  reader: WireReader,
  state: DecodeState,
  depth: number
): unknown {
  if (wireType !== expectedWireType(type, resolvedType)) {
    throw new Error(`Wire type ${wireType} does not match ${type}.`)
  }
  if (resolvedType instanceof Type) {
    const nested = reader.subReader()
    return decodeMessage(resolvedType, nested, state, depth + 1)
  }
  if (wireType === 0) {
    const value = reader.readVarint()
    if (resolvedType instanceof Enum) return enumValue(resolvedType, Number(value))
    switch (type) {
      case 'int32': return Number(BigInt.asIntN(32, value))
      case 'uint32': return Number(BigInt.asUintN(32, value))
      case 'sint32': return Number(BigInt.asIntN(32, zigZag(value)))
      case 'int64': return BigInt.asIntN(64, value)
      case 'uint64': return BigInt.asUintN(64, value)
      case 'sint64': return BigInt.asIntN(64, zigZag(value))
      case 'bool': return value !== 0n
      default: return value
    }
  }
  if (wireType === 1) {
    if (type === 'double') return reader.readDouble()
    const value = reader.readFixed64()
    return type === 'sfixed64' ? BigInt.asIntN(64, value) : value
  }
  if (wireType === 5) {
    if (type === 'float') return reader.readFloat()
    const value = reader.readFixed32()
    return type === 'sfixed32' ? new Int32Array([value])[0] : value
  }
  const bytes = reader.readBytes()
  return type === 'string' ? new TextDecoder().decode(bytes) : bytes
}

function skipValue(reader: WireReader, wireType: number, fieldNumber: number): void {
  switch (wireType) {
    case 0:
      reader.readVarint()
      return
    case 1:
      reader.ensure(8)
      reader.pos += 8
      return
    case 2: {
      const length = reader.readLength()
      reader.pos += length
      return
    }
    case 3:
      while (reader.pos < reader.end) {
        const key = reader.readVarint()
        const nestedField = Number(key >> 3n)
        const nestedWireType = Number(key & 7n)
        if (nestedWireType === 4) {
          if (nestedField !== fieldNumber) throw new Error('Mismatched Protobuf end group.')
          return
        }
        skipValue(reader, nestedWireType, nestedField)
      }
      throw new Error('Unterminated Protobuf group.')
    case 4:
      throw new Error('Unexpected Protobuf end group.')
    case 5:
      reader.ensure(4)
      reader.pos += 4
      return
    default:
      throw new Error(`Unsupported Protobuf wire type ${wireType}.`)
  }
}

function defaultMapKey(type: string): unknown {
  if (type === 'bool') return false
  if (type === 'string') return ''
  return 0
}

function mapKey(value: unknown): string {
  return typeof value === 'bigint' ? value.toString() : String(value)
}

function decodeMapEntry(
  field: MapField,
  reader: WireReader,
  state: DecodeState,
  depth: number
): [string, unknown] {
  const nested = reader.subReader()
  let key: unknown = defaultMapKey(field.keyType)
  let value: unknown = undefined
  while (nested.pos < nested.end) {
    const tag = nested.readVarint()
    const number = Number(tag >> 3n)
    const wireType = Number(tag & 7n)
    if (number === 1) {
      key = decodeValue(field.keyType, null, wireType, nested, state, depth + 1)
    } else if (number === 2) {
      value = decodeValue(field.type, field.resolvedType, wireType, nested, state, depth + 1)
    } else {
      skipValue(nested, wireType, number)
    }
  }
  return [mapKey(key), value]
}

function decodeField(
  field: Field,
  wireType: number,
  reader: WireReader,
  state: DecodeState,
  depth: number
): unknown[] {
  if (field instanceof MapField) {
    if (wireType !== 2) throw new Error(`Wire type ${wireType} does not match map ${field.name}.`)
    return [decodeMapEntry(field, reader, state, depth)]
  }
  const isPacked = wireType === 2 && field.repeated &&
    (packableTypes.has(field.type) || field.resolvedType instanceof Enum)
  if (!isPacked) {
    return [decodeValue(field.type, field.resolvedType, wireType, reader, state, depth)]
  }

  const packed = reader.subReader()
  const values: unknown[] = []
  const scalarWireType = expectedWireType(field.type, field.resolvedType)
  while (packed.pos < packed.end) {
    values.push(decodeValue(field.type, field.resolvedType, scalarWireType, packed, state, depth))
  }
  return values
}

function decodeMessage(
  type: Type,
  reader: WireReader,
  state: DecodeState,
  depth: number
): Record<string, unknown> {
  if (depth > MAX_DECODE_DEPTH) throw new Error('Protobuf nesting exceeds 32 levels.')
  const result: Record<string, unknown> = {}
  const unknownFields: Array<{ field: number; wireType: number }> = []

  while (reader.pos < reader.end) {
    state.fields += 1
    if (state.fields > MAX_DECODE_FIELDS) throw new Error('Protobuf payload exceeds 5,000 fields.')
    const tag = reader.readVarint()
    const fieldNumber = Number(tag >> 3n)
    const wireType = Number(tag & 7n)
    if (fieldNumber <= 0) throw new Error('Protobuf field number must be positive.')
    const field = type.fieldsById[fieldNumber]
    if (!field) {
      skipValue(reader, wireType, fieldNumber)
      unknownFields.push({ field: fieldNumber, wireType })
      continue
    }

    const values = decodeField(field, wireType, reader, state, depth)
    const key = field.protoName ?? field.name
    if (field instanceof MapField) {
      const map = (result[key] as Record<string, unknown> | undefined) ?? {}
      for (const entry of values as Array<[string, unknown]>) map[entry[0]] = entry[1]
      result[key] = map
    } else if (field.repeated) {
      const repeated = (result[key] as unknown[] | undefined) ?? []
      repeated.push(...values)
      result[key] = repeated
    } else {
      result[key] = values[0]
    }
  }
  if (unknownFields.length > 0) result.$unknownFields = unknownFields
  return result
}

export function decodeProtobufBytes(bytes: Uint8Array, type: Type): Record<string, unknown> {
  if (bytes.byteLength > MAX_PROTOBUF_PAYLOAD_BYTES) {
    throw new Error('Protobuf payload exceeds the 256 KB preview limit.')
  }
  type.resolveAll()
  return decodeMessage(type, new WireReader(bytes), { fields: 0 }, 0)
}

export function inspectProtobufPayload(
  payloadBase64: string,
  type: Type
): ProtobufInspection {
  const bytes = decodePayloadBytes(payloadBase64)
  if (bytes.byteLength > MAX_PROTOBUF_PAYLOAD_BYTES) {
    return { status: 'too-large', byteLength: bytes.byteLength }
  }
  try {
    const value = decodeProtobufBytes(bytes, type)
    return {
      status: 'decoded',
      byteLength: bytes.byteLength,
      value,
      tree: toPayloadTree(value)
    }
  } catch (reason) {
    return {
      status: 'invalid',
      byteLength: bytes.byteLength,
      error: reason instanceof Error ? reason.message : String(reason)
    }
  }
}
