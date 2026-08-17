import type {
  MqttPacketCommand,
  MqttPacketDirection,
  MqttPacketEvent,
  MqttPacketFlowRecord,
  MqttQos
} from './contracts'
import { createMessageId } from './message'

export const MAX_PACKET_FLOWS = 1_000

export interface RawMqttFlowPacket {
  cmd?: unknown
  messageId?: unknown
  qos?: unknown
  topic?: unknown
  dup?: unknown
  reasonCode?: unknown
}

const flowCommands = new Set<MqttPacketCommand>([
  'publish',
  'puback',
  'pubrec',
  'pubrel',
  'pubcomp'
])

function isMqttQos(value: unknown): value is MqttQos {
  return value === 0 || value === 1 || value === 2
}

export function createMqttPacketEvent(
  packet: RawMqttFlowPacket,
  direction: MqttPacketDirection,
  timestamp = new Date().toISOString(),
  id = createMessageId()
): MqttPacketEvent | undefined {
  if (typeof packet.cmd !== 'string' || !flowCommands.has(packet.cmd as MqttPacketCommand)) {
    return undefined
  }

  const event: MqttPacketEvent = {
    id,
    timestamp,
    direction,
    command: packet.cmd as MqttPacketCommand
  }
  if (Number.isInteger(packet.messageId) && Number(packet.messageId) > 0) {
    event.messageId = Number(packet.messageId)
  }
  if (isMqttQos(packet.qos)) event.qos = packet.qos
  if (typeof packet.topic === 'string') event.topic = packet.topic
  if (typeof packet.dup === 'boolean') event.duplicate = packet.dup
  if (Number.isInteger(packet.reasonCode) && Number(packet.reasonCode) >= 0) {
    event.reasonCode = Number(packet.reasonCode)
  }
  return event
}

function messageDirectionFor(event: MqttPacketEvent): MqttPacketFlowRecord['messageDirection'] {
  if (event.command === 'publish') return event.direction === 'sent' ? 'outgoing' : 'incoming'
  if (event.command === 'pubrel') return event.direction === 'sent' ? 'outgoing' : 'incoming'
  return event.direction === 'received' ? 'outgoing' : 'incoming'
}

function acknowledgmentCompletesFlow(flow: MqttPacketFlowRecord, event: MqttPacketEvent): boolean {
  return (flow.qos === 1 && event.command === 'puback') ||
    (flow.qos === 2 && event.command === 'pubcomp')
}

function hasFailureReason(event: MqttPacketEvent): boolean {
  return event.reasonCode !== undefined && event.reasonCode >= 0x80
}

function appendStep(
  flow: MqttPacketFlowRecord,
  event: MqttPacketEvent
): MqttPacketFlowRecord {
  const failed = hasFailureReason(event)
  const completed = failed || acknowledgmentCompletesFlow(flow, event)
  return {
    ...flow,
    updatedAt: event.timestamp,
    ...(completed ? { completedAt: event.timestamp } : {}),
    state: failed ? 'failed' : completed ? 'completed' : flow.state,
    steps: [...flow.steps, event]
  }
}

function findMatchingFlowIndex(
  flows: MqttPacketFlowRecord[],
  event: MqttPacketEvent
): number {
  if (event.messageId === undefined) return -1
  const messageDirection = messageDirectionFor(event)
  return flows.findIndex((flow) =>
    flow.state === 'pending' &&
    flow.messageId === event.messageId &&
    flow.messageDirection === messageDirection
  )
}

export function updateMqttPacketFlows(
  flows: MqttPacketFlowRecord[],
  event: MqttPacketEvent
): MqttPacketFlowRecord[] {
  if (event.command === 'publish') {
    const duplicateIndex = event.duplicate ? findMatchingFlowIndex(flows, event) : -1
    if (duplicateIndex >= 0) {
      return flows.map((flow, index) => index === duplicateIndex ? appendStep(flow, event) : flow)
    }

    const qos = event.qos ?? 0
    const flow: MqttPacketFlowRecord = {
      id: event.id,
      messageId: event.messageId,
      messageDirection: messageDirectionFor(event),
      topic: event.topic ?? '',
      qos,
      startedAt: event.timestamp,
      updatedAt: event.timestamp,
      ...(qos === 0 ? { completedAt: event.timestamp } : {}),
      state: qos === 0 ? 'completed' : 'pending',
      steps: [event]
    }
    return [flow, ...flows].slice(0, MAX_PACKET_FLOWS)
  }

  const flowIndex = findMatchingFlowIndex(flows, event)
  if (flowIndex < 0) return flows
  return flows.map((flow, index) => index === flowIndex ? appendStep(flow, event) : flow)
}

export function packetFlowDurationMilliseconds(flow: MqttPacketFlowRecord): number {
  const start = Date.parse(flow.startedAt)
  const end = Date.parse(flow.completedAt ?? flow.updatedAt)
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : 0
}

export function nextExpectedPacketCommand(
  flow: MqttPacketFlowRecord
): MqttPacketCommand | undefined {
  if (flow.state !== 'pending') return undefined
  if (flow.qos === 1) return 'puback'
  if (flow.qos !== 2) return undefined

  const commands = new Set(flow.steps.map(({ command }) => command))
  if (!commands.has('pubrec')) return 'pubrec'
  if (!commands.has('pubrel')) return 'pubrel'
  return 'pubcomp'
}

export function filterMqttPacketFlows(
  flows: MqttPacketFlowRecord[],
  query: string
): MqttPacketFlowRecord[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return flows

  return flows.filter((flow) => [
    flow.topic,
    flow.messageDirection,
    flow.state,
    flow.messageId?.toString() ?? '',
    ...flow.steps.map((step) => step.command)
  ].join('\n').toLocaleLowerCase().includes(normalized))
}
