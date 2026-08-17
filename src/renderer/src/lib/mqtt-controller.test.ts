import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  ConnectionConfig,
  MqttMessageRecord,
  MqttSessionId,
  MqttapeBridge,
  StatusEvent
} from '../../../shared/contracts'
import { MqttController } from './mqtt-controller'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

describe('MqttController desktop sessions', () => {
  it('routes bridge events and commands by session identifier', async () => {
    const statusListeners = new Set<(sessionId: MqttSessionId, event: StatusEvent) => void>()
    const messageListeners = new Set<(
      sessionId: MqttSessionId,
      message: MqttMessageRecord
    ) => void>()
    const connect = vi.fn(async () => {})
    const destroySession = vi.fn(async () => {})
    const bridge = {
      connect,
      destroySession,
      onStatus(listener: (sessionId: MqttSessionId, event: StatusEvent) => void) {
        statusListeners.add(listener)
        return () => statusListeners.delete(listener)
      },
      onMessage(listener: (sessionId: MqttSessionId, message: MqttMessageRecord) => void) {
        messageListeners.add(listener)
        return () => messageListeners.delete(listener)
      },
      onPacket() {
        return () => {}
      }
    } as unknown as MqttapeBridge
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { mqttape: bridge }
    })

    const first = new MqttController('broker_a')
    const second = new MqttController('broker_b')
    const firstStatuses: StatusEvent[] = []
    const secondStatuses: StatusEvent[] = []
    const firstMessages: MqttMessageRecord[] = []
    const secondMessages: MqttMessageRecord[] = []
    first.onStatus((event) => firstStatuses.push(event))
    second.onStatus((event) => secondStatuses.push(event))
    first.onMessage((message) => firstMessages.push(message))
    second.onMessage((message) => secondMessages.push(message))
    first.activate()
    second.activate()

    const config: ConnectionConfig = {
      name: 'First',
      protocol: 'mqtt',
      host: '127.0.0.1',
      port: 1883,
      path: 'mqtt',
      clientId: 'mqttape_first',
      username: '',
      password: '',
      mqttVersion: 4,
      clean: true,
      keepalive: 60,
      reconnectPeriod: 1_000,
      rejectUnauthorized: true,
      caPath: '',
      clientCertificatePath: '',
      clientKeyPath: '',
      clientKeyPassphrase: ''
    }
    await first.connect(config)

    const firstMessage: MqttMessageRecord = {
      id: 'message-a',
      direction: 'incoming',
      timestamp: '2026-08-17T10:00:00.000Z',
      topic: 'broker/a',
      qos: 0,
      retain: false,
      duplicate: false,
      payloadBase64: 'YQ==',
      payloadText: 'a',
      size: 1
    }
    statusListeners.forEach((listener) => listener('broker_b', { state: 'connected' }))
    statusListeners.forEach((listener) => listener('broker_a', { state: 'error', detail: 'a' }))
    messageListeners.forEach((listener) => listener('broker_a', firstMessage))

    expect(connect).toHaveBeenCalledWith('broker_a', config)
    expect(firstStatuses).toEqual([{ state: 'error', detail: 'a' }])
    expect(secondStatuses).toEqual([{ state: 'connected' }])
    expect(firstMessages).toEqual([firstMessage])
    expect(secondMessages).toEqual([])

    first.destroy()
    second.destroy()
    expect(destroySession).toHaveBeenCalledWith('broker_a')
    expect(destroySession).toHaveBeenCalledWith('broker_b')
    expect(statusListeners.size).toBe(0)
    expect(messageListeners.size).toBe(0)
  })
})
