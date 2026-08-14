import type { ReplayTopicRemap } from './contracts'

const MAX_TOPIC_BYTES = 65_535

export function publishTopicError(topic: string): string | null {
  if (!topic) return 'Publish topic is required.'
  if (topic.includes('\0')) return 'Publish topics cannot contain null characters.'
  if (topic.includes('#') || topic.includes('+')) {
    return 'Publish topics cannot contain MQTT wildcards (# or +).'
  }
  if (new TextEncoder().encode(topic).byteLength > MAX_TOPIC_BYTES) {
    return 'Publish topic exceeds the MQTT 65,535-byte limit.'
  }
  return null
}

function withoutTrailingSeparators(prefix: string): string {
  return prefix.replace(/\/+$/, '')
}

export function remapTopic(topic: string, rule?: ReplayTopicRemap): string {
  if (!rule) return topic

  const fromPrefix = withoutTrailingSeparators(rule.fromPrefix)
  const toPrefix = withoutTrailingSeparators(rule.toPrefix)
  if (!fromPrefix && !toPrefix) return topic

  if (!fromPrefix) return `${toPrefix}/${topic}`
  if (topic === fromPrefix) return toPrefix
  if (!topic.startsWith(`${fromPrefix}/`)) return topic

  const suffix = topic.slice(fromPrefix.length + 1)
  return toPrefix ? `${toPrefix}/${suffix}` : suffix
}
