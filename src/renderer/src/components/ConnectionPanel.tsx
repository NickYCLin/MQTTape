import type { FormEvent } from 'react'
import type { ConnectionConfig, MqttProtocol } from '../../../shared/contracts'
import { PlugIcon } from './icons'

interface ConnectionPanelProps {
  config: ConnectionConfig
  connected: boolean
  connecting: boolean
  busy: boolean
  isDesktop: boolean
  onChange: (config: ConnectionConfig) => void
  onConnect: () => void
  onDisconnect: () => void
}

const defaultPorts: Record<MqttProtocol, number> = {
  mqtt: 1883,
  mqtts: 8883,
  ws: 8083,
  wss: 8084
}

export function ConnectionPanel({
  config,
  connected,
  connecting,
  busy,
  isDesktop,
  onChange,
  onConnect,
  onDisconnect
}: ConnectionPanelProps) {
  const update = <Key extends keyof ConnectionConfig>(
    key: Key,
    value: ConnectionConfig[Key]
  ): void => onChange({ ...config, [key]: value })

  const changeProtocol = (protocol: MqttProtocol): void => {
    onChange({ ...config, protocol, port: defaultPorts[protocol] })
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (!connected && !connecting && !busy) onConnect()
  }

  return (
    <form className="panel connection-panel" onSubmit={submit}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">BROKER</span>
          <h2>Connection</h2>
        </div>
        <span className="mode-badge">{isDesktop ? 'DESKTOP' : 'WEB LITE'}</span>
      </div>

      <div className="field-grid">
        <label className="field protocol-field">
          <span>Protocol</span>
          <select
            value={config.protocol}
            disabled={connected || connecting}
            onChange={(event) => changeProtocol(event.target.value as MqttProtocol)}
          >
            {isDesktop && <option value="mqtt">MQTT</option>}
            {isDesktop && <option value="mqtts">MQTTS</option>}
            <option value="ws">WS</option>
            <option value="wss">WSS</option>
          </select>
        </label>

        <label className="field host-field">
          <span>Host</span>
          <input
            value={config.host}
            disabled={connected || connecting}
            placeholder="broker.example.com"
            spellCheck={false}
            onChange={(event) => update('host', event.target.value)}
          />
        </label>

        <label className="field port-field">
          <span>Port</span>
          <input
            type="number"
            min="1"
            max="65535"
            value={config.port}
            disabled={connected || connecting}
            onChange={(event) => update('port', Number(event.target.value))}
          />
        </label>

        {(config.protocol === 'ws' || config.protocol === 'wss') && (
          <label className="field path-field">
            <span>Path</span>
            <input
              value={config.path}
              disabled={connected || connecting}
              placeholder="mqtt"
              spellCheck={false}
              onChange={(event) => update('path', event.target.value)}
            />
          </label>
        )}

        <label className="field">
          <span>Username</span>
          <input
            value={config.username}
            disabled={connected || connecting}
            autoComplete="username"
            placeholder="Optional"
            onChange={(event) => update('username', event.target.value)}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={config.password}
            disabled={connected || connecting}
            autoComplete="current-password"
            placeholder="Not stored"
            onChange={(event) => update('password', event.target.value)}
          />
        </label>
      </div>

      <details className="advanced-settings">
        <summary>Advanced settings</summary>
        <div className="field-grid advanced-grid">
          <label className="field">
            <span>Client ID</span>
            <input
              value={config.clientId}
              disabled={connected || connecting}
              spellCheck={false}
              onChange={(event) => update('clientId', event.target.value)}
            />
          </label>
          <label className="field">
            <span>MQTT version</span>
            <select
              value={config.mqttVersion}
              disabled={connected || connecting}
              onChange={(event) => update('mqttVersion', Number(event.target.value) as 4 | 5)}
            >
              <option value={5}>5.0</option>
              <option value={4}>3.1.1</option>
            </select>
          </label>
          <label className="field">
            <span>Keep alive (sec)</span>
            <input
              type="number"
              min="0"
              value={config.keepalive}
              disabled={connected || connecting}
              onChange={(event) => update('keepalive', Number(event.target.value))}
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={config.clean}
              disabled={connected || connecting}
              onChange={(event) => update('clean', event.target.checked)}
            />
            <span>Clean session</span>
          </label>
          {(config.protocol === 'mqtts' || config.protocol === 'wss') && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={config.rejectUnauthorized}
                disabled={connected || connecting}
                onChange={(event) => update('rejectUnauthorized', event.target.checked)}
              />
              <span>Verify TLS certificate</span>
            </label>
          )}
        </div>
      </details>

      <button
        className={`primary-button ${connected ? 'disconnect-button' : ''}`}
        type={connected ? 'button' : 'submit'}
        disabled={busy}
        onClick={connected ? onDisconnect : onConnect}
      >
        <PlugIcon />
        {connecting ? 'Connecting…' : connected ? 'Disconnect' : 'Connect'}
      </button>
    </form>
  )
}
