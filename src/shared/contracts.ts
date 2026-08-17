import type { LoRaWanDownlinkHistoryFile } from './lorawan-downlink-history'

export type MqttProtocol = 'mqtt' | 'mqtts' | 'ws' | 'wss'
export type MqttQos = 0 | 1 | 2
export type MqttVersion = 4 | 5
export type TlsFileKind = 'ca' | 'certificate' | 'key'
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
  caPath: string
  clientCertificatePath: string
  clientKeyPath: string
  clientKeyPassphrase: string
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

export interface MqttUserProperty {
  name: string
  value: string
}

export interface MqttMessageProperties {
  payloadFormatIndicator?: boolean
  messageExpiryInterval?: number
  topicAlias?: number
  responseTopic?: string
  correlationDataBase64?: string
  userProperties?: MqttUserProperty[]
  subscriptionIdentifiers?: number[]
  contentType?: string
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
  properties?: MqttMessageProperties
}

export interface StatusEvent {
  state: ConnectionState
  detail?: string
}

export interface CaptureFile {
  format: 'mqttape-capture'
  version: 1
  exportedAt: string
  connection: Omit<
    ConnectionConfig,
    'password' | 'caPath' | 'clientCertificatePath' | 'clientKeyPath' | 'clientKeyPassphrase'
  >
  messages: MqttMessageRecord[]
}

export interface BrokerProfile {
  id: string
  config: ConnectionConfig
  secretsStored: boolean
}

export interface SaveBrokerProfileRequest {
  id?: string
  config: ConnectionConfig
}

export interface ReplayOptions {
  includeIncoming: boolean
  includeOutgoing: boolean
  speed: number
  topicRemap?: ReplayTopicRemap
}

export interface ReplayPreset {
  id: string
  name: string
  options: ReplayOptions
}

export interface ReplayTopicRemap {
  fromPrefix: string
  toPrefix: string
}

export type ReplayState = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled'

export type UpdateMode = 'automatic' | 'manual' | 'disabled'
export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'
export type UpdateSupportReason =
  | 'development'
  | 'portable'
  | 'unsigned-macos'
  | 'unsupported-package'

export interface AppUpdateStatus {
  mode: UpdateMode
  state: UpdateState
  currentVersion: string
  targetVersion?: string
  progress?: number
  reason?: UpdateSupportReason
}

export interface ReplayProgress {
  state: ReplayState
  sent: number
  total: number
  currentTopic?: string
}

export interface MqttapeBridge {
  connect(config: ConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  subscribe(request: SubscribeRequest): Promise<void>
  unsubscribe(topic: string): Promise<void>
  publish(request: PublishRequest): Promise<void>
  saveCapture(capture: CaptureFile): Promise<boolean>
  saveDownlinkHistory(history: LoRaWanDownlinkHistoryFile): Promise<boolean>
  listProfiles(): Promise<BrokerProfile[]>
  saveProfile(request: SaveBrokerProfileRequest): Promise<BrokerProfile>
  deleteProfile(id: string): Promise<void>
  selectTlsFile(kind: TlsFileKind): Promise<string | null>
  getUpdateStatus(): Promise<AppUpdateStatus>
  checkForUpdates(): Promise<AppUpdateStatus>
  installUpdate(): Promise<boolean>
  onStatus(listener: (event: StatusEvent) => void): () => void
  onMessage(listener: (message: MqttMessageRecord) => void): () => void
  onUpdateStatus(listener: (status: AppUpdateStatus) => void): () => void
}
