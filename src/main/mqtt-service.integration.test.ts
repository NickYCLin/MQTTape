import { createServer, type Server } from 'node:net'
import type { AddressInfo } from 'node:net'
import { Aedes } from 'aedes'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ConnectionConfig, MqttMessageRecord, StatusEvent } from '../shared/contracts'
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

function connectionConfig(port: number, clientId: string): ConnectionConfig {
  return {
    name: 'Integration broker',
    protocol: 'mqtt',
    host: '127.0.0.1',
    port,
    path: 'mqtt',
    clientId,
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

    await service.connect(connectionConfig(port, 'mqttape_test'))
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

  it('delivers and clears retained QoS 2 messages, then honors unsubscribe', async () => {
    const publisher = new MqttService(() => undefined, () => undefined)
    const received: MqttMessageRecord[] = []
    const subscriber = new MqttService(() => undefined, (message) => received.push(message))
    const topic = 'mqttape/retained/qos2'

    await publisher.connect(connectionConfig(port, 'mqttape_publisher'))
    await publisher.publish({ topic, payload: 'retained-value', qos: 2, retain: true })
    await publisher.disconnect()

    await subscriber.connect(connectionConfig(port, 'mqttape_subscriber'))
    await subscriber.subscribe({ topic, qos: 2 })
    await waitFor(() => received.some((message) => message.payloadText === 'retained-value'))

    expect(received).toEqual(expect.arrayContaining([
      expect.objectContaining({ topic, qos: 2, retain: true, payloadText: 'retained-value' })
    ]))

    await subscriber.unsubscribe(topic)
    const receivedBeforePublish = received.length
    await publisher.connect(connectionConfig(port, 'mqttape_publisher_again'))
    await publisher.publish({ topic, payload: 'after-unsubscribe', qos: 1, retain: false })
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(received).toHaveLength(receivedBeforePublish)

    await publisher.publish({ topic, payload: '', qos: 1, retain: true })
    const afterClear: MqttMessageRecord[] = []
    const verifier = new MqttService(() => undefined, (message) => afterClear.push(message))
    await verifier.connect(connectionConfig(port, 'mqttape_retained_verifier'))
    await verifier.subscribe({ topic, qos: 1 })
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(afterClear).toEqual([])

    await verifier.disconnect()
    await publisher.disconnect()
    await subscriber.disconnect()
  })
})
