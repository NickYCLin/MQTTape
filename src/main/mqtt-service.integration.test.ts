import { createServer, type Server } from 'node:net'
import type { AddressInfo } from 'node:net'
import { Aedes } from 'aedes'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { MqttMessageRecord, StatusEvent } from '../shared/contracts'
import { MqttService } from './mqtt-service'

async function waitFor(
  predicate: () => boolean,
  timeoutMilliseconds = 4_000
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for MQTT event.')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('MqttService integration', () => {
  let broker: Aedes
  let server: Server
  let port: number

  beforeAll(async () => {
    broker = await Aedes.createBroker()
    server = createServer(broker.handle)
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    port = (server.address() as AddressInfo).port
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await new Promise<void>((resolve) => broker.close(resolve))
  })

  it('connects, subscribes, publishes, and receives a TCP message', async () => {
    const statuses: StatusEvent[] = []
    const messages: MqttMessageRecord[] = []
    const service = new MqttService(
      (status) => statuses.push(status),
      (message) => messages.push(message)
    )

    await service.connect({
      name: 'Integration broker',
      protocol: 'mqtt',
      host: '127.0.0.1',
      port,
      path: 'mqtt',
      clientId: 'mqttape_test',
      username: '',
      password: '',
      mqttVersion: 4,
      clean: true,
      keepalive: 30,
      reconnectPeriod: 0,
      rejectUnauthorized: true
    })
    await service.subscribe({ topic: 'mqttape/integration', qos: 1 })
    await service.publish({
      topic: 'mqttape/integration',
      payload: '{"working":true}',
      qos: 1,
      retain: false
    })

    await waitFor(() => messages.some((message) => message.direction === 'incoming'))

    expect(statuses.some((status) => status.state === 'connected')).toBe(true)
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction: 'outgoing',
        topic: 'mqttape/integration',
        payloadText: '{"working":true}',
        qos: 1
      }),
      expect.objectContaining({
        direction: 'incoming',
        topic: 'mqttape/integration',
        payloadText: '{"working":true}',
        qos: 1
      })
    ]))

    await service.disconnect()
  })
})
