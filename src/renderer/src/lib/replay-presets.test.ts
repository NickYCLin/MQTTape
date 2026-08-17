import { describe, expect, it } from 'vitest'
import type { ReplayPreset } from '../../../shared/contracts'
import {
  deleteReplayPreset,
  readReplayPresets,
  REPLAY_PRESET_STORAGE_KEY,
  upsertReplayPreset,
  writeReplayPresets
} from './replay-presets'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const outgoingPreset: ReplayPreset = {
  id: 'outgoing',
  name: 'Sandbox outgoing',
  options: {
    includeIncoming: false,
    includeOutgoing: true,
    speed: 2,
    topicRemap: { fromPrefix: 'production', toPrefix: 'sandbox' }
  }
}

describe('replay preset storage', () => {
  it('round-trips a versioned preset document without unrelated fields', () => {
    const storage = new MemoryStorage()
    writeReplayPresets(storage, [outgoingPreset])

    const raw = storage.getItem(REPLAY_PRESET_STORAGE_KEY) || ''
    expect(raw).toContain('mqttape-replay-presets')
    expect(raw).not.toContain('password')
    expect(readReplayPresets(storage)).toEqual([outgoingPreset])
  })

  it('filters malformed and duplicate presets from stored data', () => {
    const storage = new MemoryStorage()
    storage.setItem(REPLAY_PRESET_STORAGE_KEY, JSON.stringify({
      format: 'mqttape-replay-presets',
      version: 1,
      presets: [
        outgoingPreset,
        { ...outgoingPreset, id: 'duplicate', name: 'SANDBOX OUTGOING' },
        { id: 'invalid', name: '', options: outgoingPreset.options },
        { id: 'bad-speed', name: 'Bad speed', options: { ...outgoingPreset.options, speed: 3 } }
      ]
    }))

    expect(readReplayPresets(storage)).toEqual([outgoingPreset])
  })

  it('returns an empty list for corrupt or unsupported documents', () => {
    const storage = new MemoryStorage()
    storage.setItem(REPLAY_PRESET_STORAGE_KEY, '{not-json')
    expect(readReplayPresets(storage)).toEqual([])

    storage.setItem(REPLAY_PRESET_STORAGE_KEY, JSON.stringify({
      format: 'mqttape-replay-presets',
      version: 2,
      presets: [outgoingPreset]
    }))
    expect(readReplayPresets(storage)).toEqual([])
  })

  it('creates, trims, and updates a preset by identifier', () => {
    const created = upsertReplayPreset([], {
      name: '  Safe replay  ',
      options: {
        includeIncoming: true,
        includeOutgoing: false,
        speed: 0.5,
        topicRemap: { fromPrefix: '', toPrefix: '' }
      }
    }, () => 'preset-1')

    expect(created.preset).toEqual({
      id: 'preset-1',
      name: 'Safe replay',
      options: { includeIncoming: true, includeOutgoing: false, speed: 0.5 }
    })

    const updated = upsertReplayPreset(created.presets, {
      id: 'preset-1',
      name: 'Safe replay renamed',
      options: outgoingPreset.options
    }, () => 'unused')
    expect(updated.presets).toEqual([{ ...outgoingPreset, id: 'preset-1', name: 'Safe replay renamed' }])
  })

  it('rejects duplicate names and unusable replay options', () => {
    expect(() => upsertReplayPreset([outgoingPreset], {
      name: 'sandbox OUTGOING',
      options: outgoingPreset.options
    }, () => 'other')).toThrow('already exists')

    expect(() => upsertReplayPreset([], {
      name: 'No directions',
      options: { includeIncoming: false, includeOutgoing: false, speed: 1 }
    }, () => 'invalid')).toThrow('Choose at least one direction')

    expect(() => upsertReplayPreset([outgoingPreset], {
      name: 'Different name',
      options: outgoingPreset.options
    }, () => outgoingPreset.id)).toThrow('unique replay preset identifier')

    const storage = new MemoryStorage()
    expect(() => writeReplayPresets(storage, [
      outgoingPreset,
      { ...outgoingPreset, id: 'duplicate', name: 'SANDBOX OUTGOING' }
    ])).toThrow('unique identifiers and names')
  })

  it('deletes only the selected preset', () => {
    const second = { ...outgoingPreset, id: 'second', name: 'Second' }
    expect(deleteReplayPreset([outgoingPreset, second], outgoingPreset.id)).toEqual([second])
  })
})
