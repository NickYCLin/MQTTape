import { contextBridge, ipcRenderer } from 'electron'
import type {
  CaptureFile,
  ConnectionConfig,
  MqttMessageRecord,
  MqttapeBridge,
  PublishRequest,
  StatusEvent,
  SubscribeRequest
} from '../shared/contracts'

const bridge: MqttapeBridge = {
  connect: (config: ConnectionConfig) => ipcRenderer.invoke('mqttape:connect', config),
  disconnect: () => ipcRenderer.invoke('mqttape:disconnect'),
  subscribe: (request: SubscribeRequest) => ipcRenderer.invoke('mqttape:subscribe', request),
  unsubscribe: (topic: string) => ipcRenderer.invoke('mqttape:unsubscribe', topic),
  publish: (request: PublishRequest) => ipcRenderer.invoke('mqttape:publish', request),
  saveCapture: (capture: CaptureFile) => ipcRenderer.invoke('mqttape:save-capture', capture),
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
  }
}

contextBridge.exposeInMainWorld('mqttape', bridge)
