import { Buffer } from 'node:buffer'
import { createServer, type Server } from 'node:net'
import type { AddressInfo } from 'node:net'
import { generate, parser, type IPublishPacket, type Packet } from 'mqtt-packet'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ConnectionConfig, MqttMessageRecord, StatusEvent } from '../shared/contracts'
import { MqttService } from './mqtt-service'

const packetOptions = { protocolVersion: 5 }

async function waitFor(predicate: () => boolean, timeoutMilliseconds = 4_000): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for MQTT 5 event.')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('MqttService MQTT 5 integration', () => {
  let server: Server
  let port: number
  const receivedPublishes: IPublishPacket[] = []

  beforeAll(async () => {
    server = createServer((socket) => {
      const packetParser = parser(packetOptions)
      const subscriptions = new Set<string>()
      socket.on('data', (data) => packetParser.parse(typeof data === 'string' ? Buffer.from(data) : data))
      packetParser.on('packet', (packet: Packet) => {
        switch (packet.cmd) {
          case 'connect':
            socket.write(generate({
              cmd: 'connack',
              reasonCode: 0,
              sessionPresent: false,
              properties: {
                maximumQoS: 2,
                retainAvailable: true,
                wildcardSubscriptionAvailable: true
              }
            }, packetOptions))
            break
          case 'subscribe':
            packet.subscriptions.forEach(({ topic }) => subscriptions.add(topic))
            socket.write(generate({
              cmd: 'suback',
              messageId: packet.messageId,
              granted: packet.subscriptions.map(({ qos }) => qos),
              properties: {}
            }, packetOptions))
            break
          case 'publish':
            receivedPublishes.push(packet)
            if (packet.qos === 1 && packet.messageId) {
              socket.write(generate({
                cmd: 'puback',
                messageId: packet.messageId,
                reasonCode: 0,
                properties: {}
              }, packetOptions))
            }
            if (subscriptions.has(packet.topic)) {
              socket.write(generate({
                cmd: 'publish',
                topic: packet.topic,
                payload: packet.payload,
                qos: 0,
                dup: false,
                retain: false,
                properties: {
                  payloadFormatIndicator: true,
                  messageExpiryInterval: 120,
                  responseTopic: 'mqttape/replies',
                  correlationData: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
                  contentType: 'application/json',
                  userProperties: {
                    source: ['mqttape-test', 'integration'],
                    region: 'tw'
                  },
                  subscriptionIdentifier: [7, 12]
                }
              }, packetOptions))
            }
            break
          case 'pingreq':
            socket.write(generate({ cmd: 'pingresp' }, packetOptions))
            break
          case 'disconnect':
            socket.end()
            break
        }
      })
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    port = (server.address() as AddressInfo).port
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('connects, subscribes, publishes, and receives with MQTT 5 framing', async () => {
    receivedPublishes.length = 0
    const statuses: StatusEvent[] = []
    const messages: MqttMessageRecord[] = []
    const service = new MqttService(
      (status) => statuses.push(status),
      (message) => messages.push(message)
    )
    const config: ConnectionConfig = {
      name: 'MQTT 5 test broker',
      protocol: 'mqtt',
      host: '127.0.0.1',
      port,
      path: 'mqtt',
      clientId: 'mqttape_mqtt5',
      username: '',
      password: '',
      mqttVersion: 5,
      clean: true,
      keepalive: 30,
      reconnectPeriod: 0,
      rejectUnauthorized: true,
      caPath: '',
      clientCertificatePath: '',
      clientKeyPath: '',
      clientKeyPassphrase: ''
    }

    await service.connect(config)
    await service.subscribe({ topic: 'mqttape/mqtt5', qos: 1 })
    await service.publish({
      topic: 'mqttape/mqtt5',
      payload: '{"version":5}',
      qos: 1,
      retain: false,
      properties: {
        payloadFormatIndicator: true,
        messageExpiryInterval: 60,
        responseTopic: 'mqttape/client-replies',
        correlationDataBase64: 'AQIDBA==',
        contentType: 'application/json',
        userProperties: [
          { name: 'source', value: 'mqttape' },
          { name: 'source', value: 'desktop' }
        ]
      }
    })
    await waitFor(() => messages.some((message) => message.direction === 'incoming'))
    await waitFor(() => receivedPublishes.length > 0)

    expect(statuses.some((status) => status.state === 'connected')).toBe(true)
    expect(receivedPublishes.at(-1)?.properties).toEqual({
      payloadFormatIndicator: true,
      messageExpiryInterval: 60,
      responseTopic: 'mqttape/client-replies',
      correlationData: Buffer.from([1, 2, 3, 4]),
      contentType: 'application/json',
      userProperties: { source: ['mqttape', 'desktop'] }
    })
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction: 'outgoing',
        qos: 1,
        payloadText: '{"version":5}',
        properties: {
          payloadFormatIndicator: true,
          messageExpiryInterval: 60,
          responseTopic: 'mqttape/client-replies',
          correlationDataBase64: 'AQIDBA==',
          contentType: 'application/json',
          userProperties: [
            { name: 'source', value: 'mqttape' },
            { name: 'source', value: 'desktop' }
          ]
        }
      }),
      expect.objectContaining({
        direction: 'incoming',
        qos: 0,
        payloadText: '{"version":5}',
        properties: {
          payloadFormatIndicator: true,
          messageExpiryInterval: 120,
          responseTopic: 'mqttape/replies',
          correlationDataBase64: '3q2+7w==',
          userProperties: [
            { name: 'source', value: 'mqttape-test' },
            { name: 'source', value: 'integration' },
            { name: 'region', value: 'tw' }
          ],
          subscriptionIdentifiers: [7, 12],
          contentType: 'application/json'
        }
      })
    ]))

    await service.disconnect()
  })
})
