import { describe, expect, it } from 'vitest'
import {
  DOWNLINK_HISTORY_STORAGE_KEY,
  canUseLoRaWanDownlinkHistoryStorage,
  clearLoRaWanDownlinkHistory,
  createLoRaWanDownlinkHistoryFile,
  downlinkHistoryStorageKey,
  isLoRaWanDownlinkHistoryFile,
  mergeLoRaWanDownlinkHistoryEvents,
  readLoRaWanDownlinkHistory,
  writeLoRaWanDownlinkHistory,
  type LoRaWanDownlinkEvent
} from './lorawan-downlink-history'

function event(id: string, observedAt: string): LoRaWanDownlinkEvent {
  return {
    id,
    messageId: `message-${id}`,
    provider: 'the-things-stack',
    kind: 'queued',
    status: 'queued',
    direction: 'incoming',
    observedAt,
    occurredAt: observedAt,
    topic: 'v3/app/devices/device/down/queued',
    applicationId: 'app',
    deviceId: 'device',
    correlationIds: [`mqttape:${id}`]
  }
}

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) }
  }
}

describe('LoRaWAN downlink history', () => {
  it('deduplicates events, keeps chronological order, and enforces the limit', () => {
    const first = event('first', '2026-08-17T01:00:00.000Z')
    const replacement = { ...first, status: 'sent' as const, kind: 'sent' as const }
    const latest = event('latest', '2026-08-17T01:00:02.000Z')

    expect(mergeLoRaWanDownlinkHistoryEvents([first], [latest, replacement], 2))
      .toEqual([replacement, latest])
    expect(mergeLoRaWanDownlinkHistoryEvents([first], [latest], 1)).toEqual([latest])
  })

  it('writes, restores, and clears a versioned local history file', () => {
    const storage = memoryStorage()
    const events = [event('one', '2026-08-17T01:00:00.000Z')]

    expect(writeLoRaWanDownlinkHistory(storage, events)).toBe(true)
    expect(readLoRaWanDownlinkHistory(storage)).toEqual(events)
    expect(JSON.parse(storage.getItem(DOWNLINK_HISTORY_STORAGE_KEY)!)).toMatchObject({
      format: 'mqttape-downlink-history',
      version: 1
    })

    expect(clearLoRaWanDownlinkHistory(storage)).toBe(true)
    expect(readLoRaWanDownlinkHistory(storage)).toEqual([])
  })

  it('isolates history by Broker namespace', () => {
    const storage = memoryStorage()
    const first = [event('one', '2026-08-17T01:00:00.000Z')]
    const second = [event('two', '2026-08-17T02:00:00.000Z')]

    expect(writeLoRaWanDownlinkHistory(storage, first, 'profile:first')).toBe(true)
    expect(writeLoRaWanDownlinkHistory(storage, second, 'profile:second')).toBe(true)
    expect(readLoRaWanDownlinkHistory(storage, 'profile:first')).toEqual(first)
    expect(readLoRaWanDownlinkHistory(storage, 'profile:second')).toEqual(second)
    expect(downlinkHistoryStorageKey('profile:first')).not.toBe(DOWNLINK_HISTORY_STORAGE_KEY)

    expect(clearLoRaWanDownlinkHistory(storage, 'profile:first')).toBe(true)
    expect(readLoRaWanDownlinkHistory(storage, 'profile:first')).toEqual([])
    expect(readLoRaWanDownlinkHistory(storage, 'profile:second')).toEqual(second)
  })

  it('rejects malformed history without throwing and reports unavailable storage', () => {
    const invalidStorage = {
      getItem: () => JSON.stringify({
        format: 'mqttape-downlink-history',
        version: 1,
        exportedAt: 'not-a-date',
        events: []
      })
    }
    const unavailableStorage = {
      setItem: () => { throw new Error('storage unavailable') },
      removeItem: () => { throw new Error('storage unavailable') }
    }

    expect(readLoRaWanDownlinkHistory(invalidStorage)).toEqual([])
    expect(writeLoRaWanDownlinkHistory(unavailableStorage, [])).toBe(false)
    expect(clearLoRaWanDownlinkHistory(unavailableStorage)).toBe(false)
    expect(canUseLoRaWanDownlinkHistoryStorage(unavailableStorage)).toBe(false)
    expect(canUseLoRaWanDownlinkHistoryStorage(memoryStorage())).toBe(true)
  })

  it('validates exported history files', () => {
    const history = createLoRaWanDownlinkHistoryFile([
      event('one', '2026-08-17T01:00:00.000Z')
    ], '2026-08-17T02:00:00.000Z')

    expect(isLoRaWanDownlinkHistoryFile(history)).toBe(true)
    expect(isLoRaWanDownlinkHistoryFile({ ...history, events: [{ id: 'partial' }] }))
      .toBe(false)
  })
})
