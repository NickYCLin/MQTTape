import sparkplugSchemaSource from './schemas/sparkplug_b.proto?raw'
import {
  inspectProtobufPayload,
  parseProtobufSchema,
  type ProtobufInspection,
  type ProtobufSchemaFile
} from './protobuf'

export const SPARKPLUG_SCHEMA_SOURCE_URL = 'https://github.com/eclipse-tahu/tahu/blob/master/sparkplug_b/sparkplug_b.proto'
export const SPARKPLUG_PAYLOAD_TYPE = 'org.eclipse.tahu.protobuf.Payload'

const messageTypes = new Set([
  'NBIRTH', 'NDEATH', 'NDATA', 'NCMD',
  'DBIRTH', 'DDEATH', 'DDATA', 'DCMD'
])

const dataTypeNames = [
  'Unknown', 'Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32',
  'UInt64', 'Float', 'Double', 'Boolean', 'String', 'DateTime', 'Text', 'UUID',
  'DataSet', 'Bytes', 'File', 'Template', 'PropertySet', 'PropertySetList',
  'Int8Array', 'Int16Array', 'Int32Array', 'Int64Array', 'UInt8Array',
  'UInt16Array', 'UInt32Array', 'UInt64Array', 'FloatArray', 'DoubleArray',
  'BooleanArray', 'StringArray', 'DateTimeArray'
] as const

const valueFieldNames = [
  'int_value', 'long_value', 'float_value', 'double_value', 'boolean_value',
  'string_value', 'bytes_value', 'dataset_value', 'template_value', 'extension_value'
]

const builtInSchemaFile: ProtobufSchemaFile = {
  name: 'sparkplug_b.proto',
  source: sparkplugSchemaSource
}

let cachedPayloadType: ReturnType<typeof parseProtobufSchema>['root'] | undefined

export interface SparkplugTopic {
  namespace: 'spBv1.0'
  groupId: string
  messageType: string
  edgeNodeId: string
  deviceId?: string
}

export interface SparkplugMetric {
  name?: string
  alias?: bigint
  timestamp?: bigint
  datatype?: number
  datatypeName: string
  value?: unknown
  isHistorical: boolean
  isTransient: boolean
  isNull: boolean
}

export interface SparkplugInspection extends ProtobufInspection {
  topic: SparkplugTopic
  timestamp?: bigint
  sequence?: bigint
  uuid?: string
  metrics: SparkplugMetric[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function bigintValue(value: unknown): bigint | undefined {
  return typeof value === 'bigint' ? value : undefined
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function metricValue(metric: Record<string, unknown>): unknown {
  for (const fieldName of valueFieldNames) {
    if (fieldName in metric) return metric[fieldName]
  }
  return undefined
}

function summarizeMetric(value: unknown): SparkplugMetric | undefined {
  if (!isRecord(value)) return undefined
  const datatype = numberValue(value.datatype)
  return {
    name: stringValue(value.name),
    alias: bigintValue(value.alias),
    timestamp: bigintValue(value.timestamp),
    datatype,
    datatypeName: datatype === undefined
      ? 'Unknown'
      : dataTypeNames[datatype] ?? `Unknown (${datatype})`,
    value: metricValue(value),
    isHistorical: value.is_historical === true,
    isTransient: value.is_transient === true,
    isNull: value.is_null === true
  }
}

function payloadType() {
  if (!cachedPayloadType) cachedPayloadType = parseProtobufSchema([builtInSchemaFile]).root
  return cachedPayloadType.lookupType(SPARKPLUG_PAYLOAD_TYPE)
}

export function parseSparkplugTopic(topic: string): SparkplugTopic | null {
  const levels = topic.split('/')
  if (levels.length !== 4 && levels.length !== 5) return null
  const [namespace, groupId, messageType, edgeNodeId, deviceId] = levels
  if (namespace !== 'spBv1.0' || !groupId || !messageTypes.has(messageType) || !edgeNodeId) {
    return null
  }
  if (levels.length === 5 && !deviceId) return null
  return {
    namespace,
    groupId,
    messageType,
    edgeNodeId,
    ...(deviceId ? { deviceId } : {})
  }
}

export function inspectSparkplugPayload(
  topic: string,
  payloadBase64: string
): SparkplugInspection | null {
  const parsedTopic = parseSparkplugTopic(topic)
  if (!parsedTopic) return null
  const inspection = inspectProtobufPayload(payloadBase64, payloadType())
  const payload = inspection.value
  const metrics = Array.isArray(payload?.metrics)
    ? payload.metrics.map(summarizeMetric).filter((metric): metric is SparkplugMetric => metric !== undefined)
    : []
  return {
    ...inspection,
    topic: parsedTopic,
    timestamp: bigintValue(payload?.timestamp),
    sequence: bigintValue(payload?.seq),
    uuid: stringValue(payload?.uuid),
    metrics
  }
}

export function sparkplugTimestampDate(value?: bigint): Date | undefined {
  if (value === undefined || value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return undefined
  const date = new Date(Number(value))
  return Number.isNaN(date.getTime()) ? undefined : date
}
