import { describe, expect, it } from 'vitest'
import type { ConnectionConfig } from './contracts'
import {
  appendWebSocketQueryParameters,
  defaultMqttWebSocketAuth,
  webSocketConnectionError
} from './websocket-auth'

function config(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    name: 'Broker',
    protocol: 'wss',
    host: 'broker.example.com',
    port: 8084,
    path: 'mqtt',
    clientId: 'mqttape_auth',
    username: '',
    password: '',
    mqttVersion: 5,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 1_000,
    rejectUnauthorized: true,
    caPath: '',
    clientCertificatePath: '',
    clientKeyPath: '',
    clientKeyPassphrase: '',
    websocketAuth: defaultMqttWebSocketAuth(),
    websocketHeaders: [],
    websocketQueryParameters: [],
    ...overrides
  }
}

describe('WebSocket advanced authentication', () => {
  it('accepts desktop Bearer auth, custom headers, and repeated query parameters', () => {
    expect(webSocketConnectionError(config({
      websocketAuth: { mode: 'bearer', username: '', secret: 'token' },
      websocketHeaders: [{ name: 'X-Tenant', value: 'taipei' }],
      websocketQueryParameters: [
        { name: 'scope', value: 'read' },
        { name: 'scope', value: 'write' }
      ]
    }), true)).toBeUndefined()
  })

  it('blocks header authentication in Web Lite but permits query parameters', () => {
    expect(webSocketConnectionError(config({
      websocketAuth: { mode: 'bearer', username: '', secret: 'token' }
    }), false)).toContain('Web Lite cannot set WebSocket handshake headers')
    expect(webSocketConnectionError(config({
      websocketQueryParameters: [{ name: 'access_token', value: 'token' }]
    }), false)).toBeUndefined()
  })

  it('rejects unsafe, duplicated, and conflicting headers', () => {
    expect(webSocketConnectionError(config({
      websocketHeaders: [{ name: 'Host', value: 'evil.example.com' }]
    }), true)).toContain('cannot be overridden')
    expect(webSocketConnectionError(config({
      websocketHeaders: [
        { name: 'X-Tenant', value: 'one' },
        { name: 'x-tenant', value: 'two' }
      ]
    }), true)).toContain('duplicated')
    expect(webSocketConnectionError(config({
      websocketAuth: { mode: 'basic', username: 'device', secret: 'secret' },
      websocketHeaders: [{ name: 'Authorization', value: 'custom' }]
    }), true)).toContain('Remove the custom Authorization header')
  })

  it('validates required authentication and query values', () => {
    expect(webSocketConnectionError(config({
      websocketAuth: { mode: 'basic', username: '', secret: 'secret' }
    }), true)).toContain('username is required')
    expect(webSocketConnectionError(config({
      websocketQueryParameters: [{ name: '', value: 'token' }]
    }), true)).toContain('names are required')
  })

  it('encodes query parameters without changing the original endpoint', () => {
    expect(appendWebSocketQueryParameters('wss://broker.example.com:8084/mqtt', [
      { name: 'tenant', value: '臺北 office' },
      { name: 'scope', value: 'read/write' }
    ])).toBe(
      'wss://broker.example.com:8084/mqtt?tenant=%E8%87%BA%E5%8C%97+office&scope=read%2Fwrite'
    )
    expect(appendWebSocketQueryParameters('wss://broker.example.com/mqtt', []))
      .toBe('wss://broker.example.com/mqtt')
  })
})
