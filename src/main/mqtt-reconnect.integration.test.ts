import { createServer, type Server, type Socket } from 'node:net'
import type { AddressInfo } from 'node:net'
import { Aedes } from 'aedes'
import { describe, expect, it } from 'vitest'
import type { ConnectionConfig, MqttMessageRecord, StatusEvent } from '../shared/contracts'
import { MqttService } from './mqtt-service'

interface TestBroker {
  broker: Aedes
  server: Server
  sockets: Set<Socket>
  port: number
}

async function startBroker(port = 0): Promise<TestBroker> {
  const broker = await Aedes.createBroker()
  const sockets = new Set<Socket>()
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
    broker.handle(socket)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return { broker, server, sockets, port: (server.address() as AddressInfo).port }
}

async function stopBroker(testBroker: TestBroker): Promise<void> {
  testBroker.sockets.forEach((socket) => socket.destroy())
  await new Promise<void>((resolve) => testBroker.server.close(() => resolve()))
  await new Promise<void>((resolve) => testBroker.broker.close(resolve))
}

async function waitFor(predicate: () => boolean, timeoutMilliseconds = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for MQTT reconnect event.')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

function config(port: number): ConnectionConfig {
  return {
    name: 'Reconnect broker',
    protocol: 'mqtt',
    host: '127.0.0.1',
    port,
    path: 'mqtt',
    clientId: 'mqttape_reconnect',
    username: '',
    password: '',
    mqttVersion: 4,
    clean: true,
    keepalive: 5,
    reconnectPeriod: 100,
    rejectUnauthorized: true,
    caPath: '',
    clientCertificatePath: '',
    clientKeyPath: '',
    clientKeyPassphrase: ''
  }
}

describe('MqttService reconnect integration', () => {
  it('reconnects and restores subscriptions after a broker restart', async () => {
    let testBroker = await startBroker()
    const statuses: StatusEvent[] = []
    const messages: MqttMessageRecord[] = []
    const service = new MqttService(
      (status) => statuses.push(status),
      (message) => messages.push(message)
    )

    try {
      await service.connect(config(testBroker.port))
      await service.subscribe({ topic: 'mqttape/reconnect', qos: 1 })
      await stopBroker(testBroker)
      await waitFor(() => statuses.some((status) => status.state === 'reconnecting'))

      testBroker = await startBroker(testBroker.port)
      await waitFor(() => statuses.filter((status) => status.state === 'connected').length >= 2)
      await service.publish({
        topic: 'mqttape/reconnect',
        payload: 'online-again',
        qos: 1,
        retain: false
      })
      await waitFor(() => messages.some((message) =>
        message.direction === 'incoming' && message.payloadText === 'online-again'
      ))

      expect(statuses.some((status) => status.state === 'reconnecting')).toBe(true)
    } finally {
      await service.disconnect()
      if (testBroker.server.listening) await stopBroker(testBroker)
    }
  })
})
