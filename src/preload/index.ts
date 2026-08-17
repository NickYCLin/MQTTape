import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppUpdateStatus,
  BrokerProfile,
  CaptureFile,
  ConnectionConfig,
  MqttMessageRecord,
  MqttapeBridge,
  PublishRequest,
  SaveBrokerProfileRequest,
  StatusEvent,
  SubscribeRequest,
  TlsFileKind
} from '../shared/contracts'

const bridge: MqttapeBridge = {
  connect: (config: ConnectionConfig) => ipcRenderer.invoke('mqttape:connect', config),
  disconnect: () => ipcRenderer.invoke('mqttape:disconnect'),
  subscribe: (request: SubscribeRequest) => ipcRenderer.invoke('mqttape:subscribe', request),
  unsubscribe: (topic: string) => ipcRenderer.invoke('mqttape:unsubscribe', topic),
  publish: (request: PublishRequest) => ipcRenderer.invoke('mqttape:publish', request),
  saveCapture: (capture: CaptureFile) => ipcRenderer.invoke('mqttape:save-capture', capture),
  listProfiles: (): Promise<BrokerProfile[]> => ipcRenderer.invoke('mqttape:list-profiles'),
  saveProfile: (request: SaveBrokerProfileRequest): Promise<BrokerProfile> =>
    ipcRenderer.invoke('mqttape:save-profile', request),
  deleteProfile: (id: string): Promise<void> => ipcRenderer.invoke('mqttape:delete-profile', id),
  selectTlsFile: (kind: TlsFileKind): Promise<string | null> =>
    ipcRenderer.invoke('mqttape:select-tls-file', kind),
  getUpdateStatus: (): Promise<AppUpdateStatus> =>
    ipcRenderer.invoke('mqttape:get-update-status'),
  checkForUpdates: (): Promise<AppUpdateStatus> =>
    ipcRenderer.invoke('mqttape:check-for-updates'),
  installUpdate: (): Promise<boolean> => ipcRenderer.invoke('mqttape:install-update'),
  onStatus: (listener: (event: StatusEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, status: StatusEvent): void => listener(status)
    ipcRenderer.on('mqttape:status', wrapped)
    return () => ipcRenderer.removeListener('mqttape:status', wrapped)
  },
  onMessage: (listener: (message: MqttMessageRecord) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, message: MqttMessageRecord): void =>
      listener(message)
    ipcRenderer.on('mqttape:message', wrapped)
    return () => ipcRenderer.removeListener('mqttape:message', wrapped)
  },
  onUpdateStatus: (listener: (status: AppUpdateStatus) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, status: AppUpdateStatus): void =>
      listener(status)
    ipcRenderer.on('mqttape:update-status', wrapped)
    return () => ipcRenderer.removeListener('mqttape:update-status', wrapped)
  }
}

contextBridge.exposeInMainWorld('mqttape', bridge)
