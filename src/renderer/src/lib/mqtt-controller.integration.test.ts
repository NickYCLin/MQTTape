import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Aedes } from 'aedes'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createWebSocketStream, WebSocketServer } from 'ws'
import type { ConnectionConfig, MqttMessageRecord, MqttPacketEvent, StatusEvent } from '../../../shared/contracts'
import { MqttController } from './mqtt-controller'

async function waitFor(predicate: () => boolean, timeoutMilliseconds = 4_000): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for WebSocket MQTT event.')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('MqttController Web Lite integration', () => {
  let broker: Aedes
  let server: Server
  let webSocketServer: WebSocketServer
  let port: number
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

  beforeAll(async () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis
    })
    broker = await Aedes.createBroker()
    server = createServer()
    webSocketServer = new WebSocketServer({ server, path: '/mqtt' })
    webSocketServer.on('connection', (socket, request) => {
      broker.handle(createWebSocketStream(socket), request)
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    port = (server.address() as AddressInfo).port
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => webSocketServer.close(() => resolve()))
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await new Promise<void>((resolve) => broker.close(resolve))
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  it('connects, subscribes, and preserves text and binary payloads over WebSocket', async () => {
    const statuses: StatusEvent[] = []
    const messages: MqttMessageRecord[] = []
    const packets: MqttPacketEvent[] = []
    const controller = new MqttController()
    const removeStatus = controller.onStatus((status) => statuses.push(status))
    const removeMessage = controller.onMessage((message) => messages.push(message))
    const removePacket = controller.onPacket((packet) => packets.push(packet))
    const config: ConnectionConfig = {
      name: 'WebSocket broker',
      protocol: 'ws',
      host: '127.0.0.1',
      port,
      path: 'mqtt',
      clientId: 'mqttape_web_test',
      username: '',
      password: '',
      mqttVersion: 4,
      clean: true,
      keepalive: 30,
      reconnectPeriod: 0,
      rejectUnauthorized: true,
      caPath: '',
      clientCertificatePath: '',
      clientKeyPath: '',
      clientKeyPassphrase: ''
    }

    await controller.connect(config)
    await expect(controller.publish({
      topic: 'mqttape/websocket',
      payload: 'blocked',
      qos: 0,
      retain: false,
      properties: { contentType: 'text/plain' }
    })).rejects.toThrow('MQTT 5 publish properties require an MQTT 5 connection.')
    await controller.subscribe({ topic: 'mqttape/websocket', qos: 1 })
    await controller.publish({
      topic: 'mqttape/websocket',
      payload: '{"transport":"websocket"}',
      qos: 1,
      retain: false
    })
    await waitFor(() => messages.some((message) => message.direction === 'incoming'))

    expect(statuses.some((status) => status.state === 'connected')).toBe(true)
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: 'outgoing', topic: 'mqttape/websocket' }),
      expect.objectContaining({
        direction: 'incoming',
        topic: 'mqttape/websocket',
        payloadText: '{"transport":"websocket"}'
      })
    ]))
    expect(packets).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: 'sent', command: 'publish', qos: 1, topic: 'mqttape/websocket' }),
      expect.objectContaining({ direction: 'received', command: 'puback' }),
      expect.objectContaining({ direction: 'received', command: 'publish', qos: 1, topic: 'mqttape/websocket' }),
      expect.objectContaining({ direction: 'sent', command: 'puback' })
    ]))

    const binaryPayload = 'AEH/IH4K'
    await controller.publish({
      topic: 'mqttape/websocket',
      payload: '',
      payloadBase64: binaryPayload,
      qos: 1,
      retain: false
    })
    await waitFor(() => messages.some((message) =>
      message.direction === 'incoming' && message.payloadBase64 === binaryPayload
    ))
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction: 'outgoing',
        payloadBase64: binaryPayload,
        size: 6
      }),
      expect.objectContaining({
        direction: 'incoming',
        payloadBase64: binaryPayload,
        size: 6
      })
    ]))

    await controller.disconnect()
    removeStatus()
    removeMessage()
    removePacket()
    controller.destroy()
  })
})
