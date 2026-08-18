import type {
  ConnectionConfig,
  MqttWebSocketAuth,
  MqttWebSocketNameValue
} from './contracts'

export const MAX_WEBSOCKET_HEADERS = 32
export const MAX_WEBSOCKET_QUERY_PARAMETERS = 32
export const MAX_WEBSOCKET_VALUE_LENGTH = 8_192

const HTTP_HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const forbiddenHeaders = new Set([
  'connection',
  'content-length',
  'host',
  'sec-websocket-extensions',
  'sec-websocket-key',
  'sec-websocket-protocol',
  'sec-websocket-version',
  'upgrade'
])

export function defaultMqttWebSocketAuth(): MqttWebSocketAuth {
  return { mode: 'none', username: '', secret: '' }
}

export function activeWebSocketValues(
  values: MqttWebSocketNameValue[] | undefined
): MqttWebSocketNameValue[] {
  return (values ?? []).filter(({ name, value }) => name.trim() || value)
}

export function webSocketConnectionError(
  config: ConnectionConfig,
  customHeadersSupported: boolean
): string | undefined {
  if (config.protocol !== 'ws' && config.protocol !== 'wss') return undefined

  const auth = config.websocketAuth ?? defaultMqttWebSocketAuth()
  const headers = activeWebSocketValues(config.websocketHeaders)
  const queryParameters = activeWebSocketValues(config.websocketQueryParameters)

  if (!customHeadersSupported && (auth.mode !== 'none' || headers.length > 0)) {
    return 'Web Lite cannot set WebSocket handshake headers. Use query parameters or the desktop app.'
  }
  if (headers.length > MAX_WEBSOCKET_HEADERS) {
    return `A maximum of ${MAX_WEBSOCKET_HEADERS} WebSocket headers is supported.`
  }
  if (queryParameters.length > MAX_WEBSOCKET_QUERY_PARAMETERS) {
    return `A maximum of ${MAX_WEBSOCKET_QUERY_PARAMETERS} WebSocket query parameters is supported.`
  }

  const names = new Set<string>()
  for (const { name: rawName, value } of headers) {
    const name = rawName.trim()
    if (!name) return 'WebSocket header names are required.'
    if (!HTTP_HEADER_NAME.test(name)) return `WebSocket header name "${name}" is invalid.`
    const normalized = name.toLocaleLowerCase()
    if (forbiddenHeaders.has(normalized)) {
      return `WebSocket header "${name}" is managed by the WebSocket client and cannot be overridden.`
    }
    if (names.has(normalized)) return `WebSocket header "${name}" is duplicated.`
    if (/\r|\n/.test(value)) return `WebSocket header "${name}" contains a line break.`
    if (value.length > MAX_WEBSOCKET_VALUE_LENGTH) {
      return `WebSocket header "${name}" exceeds ${MAX_WEBSOCKET_VALUE_LENGTH} characters.`
    }
    names.add(normalized)
  }

  if (auth.mode === 'basic' && !auth.username.trim()) {
    return 'A username is required for WebSocket HTTP Basic authentication.'
  }
  if ((auth.mode === 'basic' || auth.mode === 'bearer') && !auth.secret) {
    return auth.mode === 'basic'
      ? 'A password is required for WebSocket HTTP Basic authentication.'
      : 'A token is required for WebSocket Bearer authentication.'
  }
  if (/\r|\n/.test(auth.username) || /\r|\n/.test(auth.secret)) {
    return 'WebSocket authentication values cannot contain line breaks.'
  }
  if (auth.username.length > MAX_WEBSOCKET_VALUE_LENGTH ||
      auth.secret.length > MAX_WEBSOCKET_VALUE_LENGTH) {
    return `WebSocket authentication values cannot exceed ${MAX_WEBSOCKET_VALUE_LENGTH} characters.`
  }
  if (auth.mode !== 'none' && names.has('authorization')) {
    return 'Remove the custom Authorization header when an authentication preset is selected.'
  }

  for (const { name: rawName, value } of queryParameters) {
    const name = rawName.trim()
    if (!name) return 'WebSocket query parameter names are required.'
    if (/\0|\r|\n/.test(name) || /\0|\r|\n/.test(value)) {
      return `WebSocket query parameter "${name}" contains a control character.`
    }
    if (name.length > 256) return `WebSocket query parameter name "${name}" is too long.`
    if (value.length > MAX_WEBSOCKET_VALUE_LENGTH) {
      return `WebSocket query parameter "${name}" exceeds ${MAX_WEBSOCKET_VALUE_LENGTH} characters.`
    }
  }

  return undefined
}

export function appendWebSocketQueryParameters(
  endpoint: string,
  parameters: MqttWebSocketNameValue[] | undefined
): string {
  const active = activeWebSocketValues(parameters)
  if (active.length === 0) return endpoint
  const url = new URL(endpoint)
  for (const { name, value } of active) url.searchParams.append(name.trim(), value)
  return url.toString()
}
