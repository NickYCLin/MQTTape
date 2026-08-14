import type { MqttMessageRecord, ReplayOptions } from './contracts'

export const MAX_REPLAY_MESSAGES = 5_000
export const MAX_REPLAY_WINDOW_MS = 30_000
export const MAX_REPLAY_DELAY_MS = 2_000

export function selectReplayMessages(
  messages: MqttMessageRecord[],
  options: ReplayOptions
): MqttMessageRecord[] {
  return messages
    .filter((message) =>
      message.direction === 'incoming' ? options.includeIncoming : options.includeOutgoing
    )
    .slice(0, MAX_REPLAY_MESSAGES)
}

export function replayTimingScale(messages: MqttMessageRecord[]): number {
  if (messages.length < 2) return 1

  const firstTime = Date.parse(messages[0].timestamp)
  const lastTime = Date.parse(messages.at(-1)!.timestamp)
  const duration = lastTime - firstTime
  if (!Number.isFinite(duration) || duration <= 0) return 1
  return duration > MAX_REPLAY_WINDOW_MS ? MAX_REPLAY_WINDOW_MS / duration : 1
}

export function replayDelay(
  previousTimestamp: string,
  timestamp: string,
  timingScale: number,
  speed: number
): number {
  const previousTime = Date.parse(previousTimestamp)
  const messageTime = Date.parse(timestamp)
  const rawDelay = messageTime - previousTime
  if (!Number.isFinite(rawDelay) || rawDelay <= 0) return 0

  const normalizedSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1
  return Math.min((rawDelay * timingScale) / normalizedSpeed, MAX_REPLAY_DELAY_MS)
}
