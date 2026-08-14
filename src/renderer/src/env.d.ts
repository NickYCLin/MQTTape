/// <reference types="vite/client" />

import type { MqttapeBridge } from '../../shared/contracts'

declare global {
  interface Window {
    mqttape?: MqttapeBridge
  }
}

export {}
