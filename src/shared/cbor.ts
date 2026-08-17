import { decodeMultiple } from 'cbor-x/decode'
import { decodePayloadBytes } from './message'
import {
  isStructuredPayloadValue,
  toPayloadTree,
  type PayloadTreeNode
} from './payload-tree'

export const MAX_STRUCTURED_PAYLOAD_BYTES = 256 * 1024

export type CborInspectionStatus = 'decoded' | 'invalid' | 'not-detected' | 'too-large'

export interface CborInspection {
  status: CborInspectionStatus
  explicit: boolean
  byteLength: number
  valueCount?: number
  tree?: PayloadTreeNode
  error?: string
}

export function isCborContentType(contentType?: string): boolean {
  if (!contentType) return false
  const mediaType = contentType.split(';', 1)[0].trim().toLocaleLowerCase()
  return mediaType === 'application/cbor' ||
    mediaType === 'application/cbor-seq' ||
    mediaType.endsWith('+cbor')
}

export function inspectCborPayload(
  payloadBase64: string,
  contentType?: string
): CborInspection {
  const explicit = isCborContentType(contentType)
  const bytes = decodePayloadBytes(payloadBase64)
  if (bytes.byteLength === 0) {
    return {
      status: explicit ? 'invalid' : 'not-detected',
      explicit,
      byteLength: 0,
      ...(explicit ? { error: 'CBOR payload is empty.' } : {})
    }
  }
  if (bytes.byteLength > MAX_STRUCTURED_PAYLOAD_BYTES) {
    return {
      status: explicit ? 'too-large' : 'not-detected',
      explicit,
      byteLength: bytes.byteLength,
      ...(explicit ? { error: 'CBOR payload exceeds the preview limit.' } : {})
    }
  }

  try {
    const values = decodeMultiple(bytes) as unknown[]
    if (values.length === 0) throw new Error('CBOR payload does not contain a complete value.')
    const decoded = values.length === 1 ? values[0] : values
    if (!explicit && !isStructuredPayloadValue(decoded)) {
      return { status: 'not-detected', explicit, byteLength: bytes.byteLength }
    }
    return {
      status: 'decoded',
      explicit,
      byteLength: bytes.byteLength,
      valueCount: values.length,
      tree: toPayloadTree(decoded)
    }
  } catch (reason) {
    return {
      status: explicit ? 'invalid' : 'not-detected',
      explicit,
      byteLength: bytes.byteLength,
      ...(explicit
        ? { error: reason instanceof Error ? reason.message : String(reason) }
        : {})
    }
  }
}
