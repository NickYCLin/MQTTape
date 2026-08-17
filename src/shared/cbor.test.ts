import { encode } from 'cbor-x'
import { describe, expect, it } from 'vitest'
import { encodePayloadBytes } from './message'
import { inspectCborPayload, isCborContentType } from './cbor'

describe('CBOR payload inspection', () => {
  it('recognizes standard and structured-suffix media types', () => {
    expect(isCborContentType('application/cbor')).toBe(true)
    expect(isCborContentType('application/cbor; profile="sensor"')).toBe(true)
    expect(isCborContentType('application/senml+cbor')).toBe(true)
    expect(isCborContentType('application/json')).toBe(false)
  })

  it('decodes a structured CBOR payload without requiring a content type', () => {
    const payload = encodePayloadBytes(encode({
      temperature: 24.5,
      online: true,
      samples: [1, 2, 3]
    }))
    const inspection = inspectCborPayload(payload)

    expect(inspection.status).toBe('decoded')
    expect(inspection.explicit).toBe(false)
    expect(inspection.tree).toEqual(expect.objectContaining({ kind: 'object' }))
    expect(inspection.tree?.children?.map(({ key }) => key)).toEqual([
      'temperature',
      'online',
      'samples'
    ])
  })

  it('keeps scalar and invalid binary payloads hidden unless CBOR is explicit', () => {
    const scalar = encodePayloadBytes(encode(42))
    expect(inspectCborPayload(scalar).status).toBe('not-detected')
    expect(inspectCborPayload(scalar, 'application/cbor').status).toBe('decoded')

    const invalid = encodePayloadBytes(new Uint8Array([0x1a, 0x00]))
    expect(inspectCborPayload(invalid).status).toBe('not-detected')
    expect(inspectCborPayload(invalid, 'application/cbor')).toEqual(expect.objectContaining({
      status: 'invalid',
      explicit: true
    }))
  })

  it('supports CBOR sequences as multiple root values', () => {
    const chunks = [encode({ index: 1 }), encode({ index: 2 })]
    const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
    let offset = 0
    chunks.forEach((chunk) => {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    })
    const inspection = inspectCborPayload(encodePayloadBytes(bytes), 'application/cbor-seq')
    expect(inspection.status).toBe('decoded')
    expect(inspection.valueCount).toBe(2)
    expect(inspection.tree?.kind).toBe('array')
  })
})
