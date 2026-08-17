import { describe, expect, it } from 'vitest'
import sparkplugSchemaSource from './schemas/sparkplug_b.proto?raw'
import { encodePayloadBytes } from './message'
import { parseProtobufSchema } from './protobuf'
import {
  inspectSparkplugPayload,
  parseSparkplugTopic,
  sparkplugTimestampDate
} from './sparkplug'

describe('Sparkplug B inspection', () => {
  it('parses node and device topic namespaces', () => {
    expect(parseSparkplugTopic('spBv1.0/factory/NBIRTH/edge-1')).toEqual({
      namespace: 'spBv1.0',
      groupId: 'factory',
      messageType: 'NBIRTH',
      edgeNodeId: 'edge-1'
    })
    expect(parseSparkplugTopic('spBv1.0/factory/DDATA/edge-1/motor-2')?.deviceId).toBe('motor-2')
    expect(parseSparkplugTopic('spBv1.0/factory/INVALID/edge-1')).toBeNull()
    expect(parseSparkplugTopic('other/factory/NBIRTH/edge-1')).toBeNull()
  })

  it('decodes the official payload schema and summarizes metrics', () => {
    const parsed = parseProtobufSchema([{ name: 'sparkplug_b.proto', source: sparkplugSchemaSource }])
    const type = parsed.root.lookupType('org.eclipse.tahu.protobuf.Payload')
    const bytes = type.encode({
      timestamp: '1723860000123',
      seq: '7',
      uuid: 'schema-v1',
      metrics: [
        {
          name: 'Line 1/Temperature',
          alias: '42',
          timestamp: '1723860000100',
          datatype: 10,
          double_value: 23.75
        },
        {
          name: 'Line 1/Running',
          datatype: 11,
          boolean_value: true,
          is_historical: true
        }
      ]
    }).finish()

    const inspection = inspectSparkplugPayload(
      'spBv1.0/factory/DDATA/edge-1/device-1',
      encodePayloadBytes(bytes)
    )

    expect(inspection?.status).toBe('decoded')
    expect(inspection?.sequence).toBe(7n)
    expect(inspection?.uuid).toBe('schema-v1')
    expect(inspection?.metrics).toEqual([
      expect.objectContaining({
        name: 'Line 1/Temperature',
        alias: 42n,
        datatypeName: 'Double',
        value: 23.75
      }),
      expect.objectContaining({
        name: 'Line 1/Running',
        datatypeName: 'Boolean',
        value: true,
        isHistorical: true
      })
    ])
  })

  it('handles invalid payloads and timestamp ranges safely', () => {
    const inspection = inspectSparkplugPayload(
      'spBv1.0/factory/NDATA/edge-1',
      encodePayloadBytes(Uint8Array.from([0x0a, 0x05, 0x01]))
    )

    expect(inspection?.status).toBe('invalid')
    expect(sparkplugTimestampDate(1723860000123n)?.toISOString()).toBe('2024-08-17T02:00:00.123Z')
    expect(sparkplugTimestampDate(2n ** 63n)).toBeUndefined()
  })
})
