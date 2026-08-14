export type MqttProtocol = 'mqtt' | 'mqtts' | 'ws' | 'wss'
export type MqttQos = 0 | 1 | 2
export type MqttVersion = 4 | 5
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'error'

export interface ConnectionConfig {
  name: string
  protocol: MqttProtocol
  host: string
  port: number
  path: string
  clientId: string
  username: string
  password: string
  mqttVersion: MqttVersion
  clean: boolean
  keepalive: number
  reconnectPeriod: number
  rejectUnauthorized: boolean
}

export interface PublishRequest {
  topic: string
  payload: string
  payloadBase64?: string
  qos: MqttQos
  retain: boolean
}

export interface SubscribeRequest {
  topic: string
  qos: MqttQos
}

export interface MqttMessageRecord {
  id: string
  direction: 'incoming' | 'outgoing'
  timestamp: string
  topic: string
  qos: MqttQos
  retain: boolean
  duplicate: boolean
  payloadBase64: string
  payloadText: string
  size: number
}

export interface StatusEvent {
  state: ConnectionState
  detail?: string
}

export interface CaptureFile {
  format: 'mqttape-capture'
  version: 1
  exportedAt: string
  connection: Omit<ConnectionConfig, 'password'>
  messages: MqttMessageRecord[]
}

export interface MqttapeBridge {
  connect(config: ConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  subscribe(request: SubscribeRequest): Promise<void>
  unsubscribe(topic: string): Promise<void>
  publish(request: PublishRequest): Promise<void>
  saveCapture(capture: CaptureFile): Promise<boolean>
  onStatus(listener: (event: StatusEvent) => void): () => void
  onMessage(listener: (message: MqttMessageRecord) => void): () => void
}
