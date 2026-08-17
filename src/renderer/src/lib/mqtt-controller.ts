import type { IClientPublishOptions, MqttClient } from 'mqtt'
import { Buffer } from 'buffer'
import type {
  ConnectionConfig,
  MqttMessageRecord,
  MqttPacketEvent,
  PublishRequest,
  StatusEvent,
  SubscribeRequest
} from '../../../shared/contracts'
import {
  mqttPublishPropertiesProtocolError,
  normalizeMqttPublishProperties,
  toMqttPublishPacketProperties,
  toMqttPublishProperties
} from '../../../shared/mqtt-properties'
import { publishTopicError } from '../../../shared/mqtt-topic'
import { createMqttPacketEvent } from '../../../shared/packet-flow'
import { mqttLastWillOptions } from '../../../shared/mqtt-will'

type StatusListener = (event: StatusEvent) => void
type MessageListener = (message: MqttMessageRecord) => void
type PacketListener = (event: MqttPacketEvent) => void

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function brokerUrl(config: ConnectionConfig): string {
  const rawHost = config.host.trim()
  const host = rawHost.includes(':') && !rawHost.startsWith('[') ? `[${rawHost}]` : rawHost
  const path = `/${config.path.trim().replace(/^\/+/, '')}`
  return `${config.protocol}://${host}:${config.port}${path}`
}

export class MqttController {
  private webClient: MqttClient | undefined
  private statusListeners = new Set<StatusListener>()
  private messageListeners = new Set<MessageListener>()
  private packetListeners = new Set<PacketListener>()
  private bridgeCleanup: Array<() => void> = []

  activate(): void {
    if (window.mqttape && this.bridgeCleanup.length === 0) {
      this.bridgeCleanup = [
        window.mqttape.onStatus((event) => this.emitStatus(event)),
        window.mqttape.onMessage((message) => this.emitMessage(message)),
        window.mqttape.onPacket((event) => this.emitPacket(event))
      ]
    }
  }

  get isDesktop(): boolean {
    return Boolean(window.mqttape)
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  onPacket(listener: PacketListener): () => void {
    this.packetListeners.add(listener)
    return () => this.packetListeners.delete(listener)
  }

  async connect(config: ConnectionConfig): Promise<void> {
    if (window.mqttape) {
      await window.mqttape.connect(config)
      return
    }

    if (config.protocol !== 'ws' && config.protocol !== 'wss') {
      throw new Error('Web Lite only supports MQTT over WebSocket (ws/wss).')
    }
    if (!config.host.trim()) throw new Error('Broker host is required.')

    await this.disconnect()
    this.emitStatus({ state: 'connecting', detail: brokerUrl(config) })

    const { default: mqtt } = await import('mqtt')
    const will = mqttLastWillOptions(config.will, config.mqttVersion)
    const client = mqtt.connect(brokerUrl(config), {
      clientId: config.clientId || undefined,
      username: config.username || undefined,
      password: config.password || undefined,
      protocolVersion: config.mqttVersion,
      clean: config.clean,
      keepalive: config.keepalive,
      reconnectPeriod: config.reconnectPeriod,
      connectTimeout: 15_000,
      rejectUnauthorized: config.rejectUnauthorized,
      resubscribe: true,
      ...(will
        ? {
            will: {
              ...will,
              payload: Buffer.from(will.payload)
            }
          }
        : {})
    })
    this.webClient = client
    this.bindWebEvents(client, config)

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup()
        client.end(true)
        reject(new Error('Connection timed out after 15 seconds.'))
      }, 15_000)
      const handleConnect = (): void => {
        cleanup()
        resolve()
      }
      const handleError = (error: Error): void => {
        cleanup()
        client.end(true)
        reject(error)
      }
      const cleanup = (): void => {
        window.clearTimeout(timeout)
        client.off('connect', handleConnect)
        client.off('error', handleError)
      }

      client.once('connect', handleConnect)
      client.once('error', handleError)
    })
  }

  async disconnect(): Promise<void> {
    if (window.mqttape) {
      await window.mqttape.disconnect()
      return
    }

    const client = this.webClient
    this.webClient = undefined
    if (!client) return

    await new Promise<void>((resolve, reject) => {
      client.end(false, {}, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
    this.emitStatus({ state: 'disconnected' })
  }

  async subscribe(request: SubscribeRequest): Promise<void> {
    if (window.mqttape) return window.mqttape.subscribe(request)
    const client = this.requireWebClient()

    await new Promise<void>((resolve, reject) => {
      client.subscribe(request.topic, { qos: request.qos }, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async unsubscribe(topic: string): Promise<void> {
    if (window.mqttape) return window.mqttape.unsubscribe(topic)
    const client = this.requireWebClient()

    await new Promise<void>((resolve, reject) => {
      client.unsubscribe(topic, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async publish(request: PublishRequest): Promise<void> {
    if (window.mqttape) return window.mqttape.publish(request)
    const client = this.requireWebClient()
    const topic = request.topic.trim()
    const topicError = publishTopicError(topic)
    if (topicError) throw new Error(topicError)
    const mqttVersion = client.options.protocolVersion === 5 ? 5 : 4
    const propertiesError = mqttPublishPropertiesProtocolError(mqttVersion, request.properties)
    if (propertiesError) throw new Error(propertiesError)
    const properties = toMqttPublishPacketProperties(
      request.properties,
      (base64) => Buffer.from(base64, 'base64')
    )
    const options: IClientPublishOptions = {
      qos: request.qos,
      retain: request.retain,
      ...(properties ? { properties } : {})
    }
    const payload = request.payloadBase64
      ? Buffer.from(base64ToBytes(request.payloadBase64))
      : Buffer.from(request.payload, 'utf8')

    await new Promise<void>((resolve, reject) => {
      client.publish(
        topic,
        payload,
        options,
        (error) => {
          if (error) {
            reject(error)
            return
          }
          this.emitMessage({
            id: createId(),
            direction: 'outgoing',
            timestamp: new Date().toISOString(),
            topic,
            qos: request.qos,
            retain: request.retain,
            duplicate: false,
            payloadBase64: bytesToBase64(payload),
            payloadText: request.payloadBase64
              ? new TextDecoder().decode(payload)
              : request.payload,
            size: payload.byteLength,
            properties: toMqttPublishProperties(request.properties)
          })
          resolve()
        }
      )
    })
  }

  destroy(): void {
    this.bridgeCleanup.forEach((cleanup) => cleanup())
    this.bridgeCleanup = []
    this.webClient?.end(true)
    this.webClient = undefined
  }

  private bindWebEvents(client: MqttClient, config: ConnectionConfig): void {
    client.on('connect', () =>
      this.emitStatus({ state: 'connected', detail: brokerUrl(config) })
    )
    client.on('reconnect', () => this.emitStatus({ state: 'reconnecting' }))
    client.on('offline', () => this.emitStatus({ state: 'offline' }))
    client.on('close', () => {
      if (this.webClient === client) this.emitStatus({ state: 'disconnected' })
    })
    client.on('error', (error) =>
      this.emitStatus({ state: 'error', detail: error.message })
    )
    client.on('packetsend', (packet) => {
      const event = createMqttPacketEvent(packet, 'sent')
      if (event) this.emitPacket(event)
    })
    client.on('packetreceive', (packet) => {
      const event = createMqttPacketEvent(packet, 'received')
      if (event) this.emitPacket(event)
    })
    client.on('message', (topic, payload, packet) => {
      const bytes = new Uint8Array(payload)
      this.emitMessage({
        id: createId(),
        direction: 'incoming',
        timestamp: new Date().toISOString(),
        topic,
        qos: packet.qos,
        retain: packet.retain,
        duplicate: packet.dup,
        payloadBase64: bytesToBase64(bytes),
        payloadText: new TextDecoder().decode(bytes),
        size: bytes.byteLength,
        properties: normalizeMqttPublishProperties(packet.properties, bytesToBase64)
      })
    })
  }

  private requireWebClient(): MqttClient {
    if (!this.webClient?.connected) throw new Error('Connect to a broker first.')
    return this.webClient
  }

  private emitStatus(event: StatusEvent): void {
    this.statusListeners.forEach((listener) => listener(event))
  }

  private emitMessage(message: MqttMessageRecord): void {
    this.messageListeners.forEach((listener) => listener(message))
  }

  private emitPacket(event: MqttPacketEvent): void {
    this.packetListeners.forEach((listener) => listener(event))
  }
}
