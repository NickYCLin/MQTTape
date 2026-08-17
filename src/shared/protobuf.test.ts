import { describe, expect, it } from 'vitest'
import type { Type } from 'protobufjs'
import { encodePayloadBytes } from './message'
import {
  PROTOBUF_SCHEMA_STORAGE_KEY,
  decodeProtobufBytes,
  inspectProtobufPayload,
  isProtobufContentType,
  parseProtobufSchema,
  readProtobufSchemas,
  writeProtobufSchemas,
  type StoredProtobufSchema
} from './protobuf'

const schemaSource = `
  syntax = "proto3";
  package test;
  enum State { UNKNOWN = 0; READY = 1; }
  message Child { bool active = 1; }
  message Sample {
    uint64 id = 1;
    sint32 temperature = 2;
    repeated uint32 samples = 3 [packed = true];
    string label = 4;
    bytes data = 5;
    State state = 6;
    Child child = 7;
    map<string, int32> values = 8;
  }
`

function encodedSample(): { bytes: Uint8Array; type: Type } {
  const parsed = parseProtobufSchema([{ name: 'sample.proto', source: schemaSource }])
  const type = parsed.root.lookupType('test.Sample')
  const bytes = type.encode({
    id: '9007199254740993',
    temperature: -17,
    samples: [1, 2, 300],
    label: 'sensor',
    data: Uint8Array.from([0xde, 0xad]),
    state: 1,
    child: { active: true },
    values: { alpha: -2 }
  }).finish()
  return { bytes, type }
}

describe('Protobuf schema parsing and wire decoding', () => {
  it('parses multiple schema files and lists nested message types', () => {
    const parsed = parseProtobufSchema([
      { name: 'common.proto', source: 'syntax = "proto3"; package demo; message Common { string id = 1; }' },
      { name: 'event.proto', source: 'syntax = "proto3"; package demo; import "common.proto"; message Event { Common common = 1; message Meta { bool ok = 1; } }' }
    ])

    expect(parsed.messageTypes).toEqual(['demo.Common', 'demo.Event', 'demo.Event.Meta'])
  })

  it('decodes scalars, packed fields, nested messages, enums, maps, and 64-bit integers', () => {
    const { bytes, type } = encodedSample()
    const value = decodeProtobufBytes(bytes, type)

    expect(value).toMatchObject({
      id: 9007199254740993n,
      temperature: -17,
      samples: [1, 2, 300],
      label: 'sensor',
      state: 'READY (1)',
      child: { active: true },
      values: { alpha: -2 }
    })
    expect(value.data).toEqual(Uint8Array.from([0xde, 0xad]))
  })

  it('preserves unknown field diagnostics and produces a bounded payload tree', () => {
    const { bytes, type } = encodedSample()
    const withUnknown = Uint8Array.from([...bytes, 0x98, 0x06, 0x07])
    const inspection = inspectProtobufPayload(encodePayloadBytes(withUnknown), type)

    expect(inspection.status).toBe('decoded')
    expect(inspection.value?.$unknownFields).toEqual([{ field: 99, wireType: 0 }])
    expect(inspection.tree?.kind).toBe('object')
  })

  it('rejects truncated or mismatched wire data', () => {
    const { type } = encodedSample()
    const inspection = inspectProtobufPayload(encodePayloadBytes(Uint8Array.from([0x22, 0x05, 0x41])), type)

    expect(inspection.status).toBe('invalid')
    expect(inspection.error).toContain('Unexpected end')
  })

  it('recognizes common Protobuf content types', () => {
    expect(isProtobufContentType('application/protobuf')).toBe(true)
    expect(isProtobufContentType('application/example+protobuf; charset=binary')).toBe(true)
    expect(isProtobufContentType('application/octet-stream')).toBe(false)
  })
})

describe('Protobuf schema storage', () => {
  const schema: StoredProtobufSchema = {
    id: 'sample',
    name: 'Sample',
    files: [{ name: 'sample.proto', source: schemaSource }],
    selectedType: 'test.Sample',
    savedAt: '2026-08-17T00:00:00.000Z'
  }

  it('round-trips valid local schemas', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    }

    writeProtobufSchemas(storage, [schema])
    expect(values.has(PROTOBUF_SCHEMA_STORAGE_KEY)).toBe(true)
    expect(readProtobufSchemas(storage)).toEqual([schema])
  })

  it('ignores corrupted storage', () => {
    expect(readProtobufSchemas({ getItem: () => '{' })).toEqual([])
    expect(readProtobufSchemas({ getItem: () => '[{"name":12}]' })).toEqual([])
  })
})
