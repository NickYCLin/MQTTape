import type { ReplayOptions, ReplayPreset } from '../../../shared/contracts'

export const REPLAY_PRESET_STORAGE_KEY = 'mqttape:replay-presets:v1'
export const REPLAY_PRESET_SPEEDS = [0.25, 0.5, 1, 2, 4] as const

const REPLAY_PRESET_FORMAT = 'mqttape-replay-presets'
const REPLAY_PRESET_VERSION = 1
const MAX_REPLAY_PRESETS = 50
const MAX_REPLAY_PRESET_NAME_LENGTH = 80
const MAX_REPLAY_PRESET_ID_LENGTH = 128

type ReplayPresetReader = Pick<Storage, 'getItem'>
type ReplayPresetWriter = Pick<Storage, 'setItem'>

interface ReplayPresetDocument {
  format: typeof REPLAY_PRESET_FORMAT
  version: typeof REPLAY_PRESET_VERSION
  presets: ReplayPreset[]
}

export interface ReplayPresetDraft {
  id?: string
  name: string
  options: ReplayOptions
}

export interface ReplayPresetSaveResult {
  preset: ReplayPreset
  presets: ReplayPreset[]
}

function compareReplayPresets(left: ReplayPreset, right: ReplayPreset): number {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
}

function normalizeReplayOptions(value: unknown): ReplayOptions | null {
  if (!value || typeof value !== 'object') return null

  const options = value as Partial<ReplayOptions>
  if (
    typeof options.includeIncoming !== 'boolean' ||
    typeof options.includeOutgoing !== 'boolean' ||
    !REPLAY_PRESET_SPEEDS.includes(options.speed as (typeof REPLAY_PRESET_SPEEDS)[number])
  ) return null

  if (!options.includeIncoming && !options.includeOutgoing) return null

  if (options.topicRemap === undefined) {
    return {
      includeIncoming: options.includeIncoming,
      includeOutgoing: options.includeOutgoing,
      speed: options.speed as number
    }
  }

  if (
    !options.topicRemap ||
    typeof options.topicRemap !== 'object' ||
    typeof options.topicRemap.fromPrefix !== 'string' ||
    typeof options.topicRemap.toPrefix !== 'string'
  ) return null

  const topicRemap = options.topicRemap.fromPrefix || options.topicRemap.toPrefix
    ? {
        fromPrefix: options.topicRemap.fromPrefix,
        toPrefix: options.topicRemap.toPrefix
      }
    : undefined

  return {
    includeIncoming: options.includeIncoming,
    includeOutgoing: options.includeOutgoing,
    speed: options.speed as number,
    topicRemap
  }
}

function normalizeReplayPreset(value: unknown): ReplayPreset | null {
  if (!value || typeof value !== 'object') return null

  const preset = value as Partial<ReplayPreset>
  const id = typeof preset.id === 'string' ? preset.id.trim() : ''
  const name = typeof preset.name === 'string' ? preset.name.trim() : ''
  const options = normalizeReplayOptions(preset.options)

  if (
    !id ||
    id.length > MAX_REPLAY_PRESET_ID_LENGTH ||
    !name ||
    name.length > MAX_REPLAY_PRESET_NAME_LENGTH ||
    !options
  ) return null

  return { id, name, options }
}

export function readReplayPresets(storage: ReplayPresetReader): ReplayPreset[] {
  try {
    const raw = storage.getItem(REPLAY_PRESET_STORAGE_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return []

    const document = parsed as Partial<ReplayPresetDocument>
    if (
      document.format !== REPLAY_PRESET_FORMAT ||
      document.version !== REPLAY_PRESET_VERSION ||
      !Array.isArray(document.presets)
    ) return []

    const presets: ReplayPreset[] = []
    const ids = new Set<string>()

    for (const value of document.presets) {
      const preset = normalizeReplayPreset(value)
      if (!preset) continue

      const duplicateName = presets.some((candidate) =>
        candidate.name.localeCompare(preset.name, undefined, { sensitivity: 'base' }) === 0
      )
      if (ids.has(preset.id) || duplicateName) continue

      ids.add(preset.id)
      presets.push(preset)
      if (presets.length === MAX_REPLAY_PRESETS) break
    }

    return presets.sort(compareReplayPresets)
  } catch {
    return []
  }
}

export function writeReplayPresets(
  storage: ReplayPresetWriter,
  presets: ReplayPreset[]
): void {
  const normalized = presets.map(normalizeReplayPreset)
  if (normalized.some((preset) => preset === null)) {
    throw new Error('Replay presets contain invalid data.')
  }

  const validPresets = normalized.filter((preset): preset is ReplayPreset => preset !== null)
  if (validPresets.length > MAX_REPLAY_PRESETS) {
    throw new Error(`Replay presets are limited to ${MAX_REPLAY_PRESETS}.`)
  }

  const ids = new Set<string>()
  for (const preset of validPresets) {
    const duplicateName = validPresets.some((candidate) =>
      candidate !== preset &&
      candidate.name.localeCompare(preset.name, undefined, { sensitivity: 'base' }) === 0
    )
    if (ids.has(preset.id) || duplicateName) {
      throw new Error('Replay presets must use unique identifiers and names.')
    }
    ids.add(preset.id)
  }

  const document: ReplayPresetDocument = {
    format: REPLAY_PRESET_FORMAT,
    version: REPLAY_PRESET_VERSION,
    presets: validPresets
  }
  storage.setItem(REPLAY_PRESET_STORAGE_KEY, JSON.stringify(document))
}

export function upsertReplayPreset(
  presets: ReplayPreset[],
  draft: ReplayPresetDraft,
  createId: () => string
): ReplayPresetSaveResult {
  const name = draft.name.trim()
  if (!name) throw new Error('Preset name is required.')
  if (name.length > MAX_REPLAY_PRESET_NAME_LENGTH) {
    throw new Error(`Preset name must be ${MAX_REPLAY_PRESET_NAME_LENGTH} characters or fewer.`)
  }

  const options = normalizeReplayOptions(draft.options)
  if (!options) throw new Error('Choose at least one direction and a supported replay speed.')

  const id = (draft.id || createId()).trim()
  if (!id || id.length > MAX_REPLAY_PRESET_ID_LENGTH) {
    throw new Error('Unable to create a valid replay preset identifier.')
  }

  const duplicateName = presets.find((preset) =>
    preset.id !== id && preset.name.localeCompare(name, undefined, { sensitivity: 'base' }) === 0
  )
  if (duplicateName) throw new Error(`A replay preset named “${name}” already exists.`)

  const exists = presets.some((preset) => preset.id === id)
  if (!draft.id && exists) {
    throw new Error('Unable to create a unique replay preset identifier.')
  }
  if (!exists && presets.length >= MAX_REPLAY_PRESETS) {
    throw new Error(`Replay presets are limited to ${MAX_REPLAY_PRESETS}.`)
  }

  const preset: ReplayPreset = { id, name, options }
  const next = presets.filter((candidate) => candidate.id !== id)
  next.push(preset)
  next.sort(compareReplayPresets)
  return { preset, presets: next }
}

export function deleteReplayPreset(presets: ReplayPreset[], id: string): ReplayPreset[] {
  return presets.filter((preset) => preset.id !== id).sort(compareReplayPresets)
}
