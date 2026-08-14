import type { FormEvent } from 'react'
import type {
  BrokerProfile,
  ConnectionConfig,
  MqttProtocol,
  TlsFileKind
} from '../../../shared/contracts'
import { PlugIcon } from './icons'

interface ConnectionPanelProps {
  config: ConnectionConfig
  connected: boolean
  connecting: boolean
  busy: boolean
  isDesktop: boolean
  profiles: BrokerProfile[]
  selectedProfileId: string
  onChange: (config: ConnectionConfig) => void
  onConnect: () => void
  onDisconnect: () => void
  onSelectProfile: (id: string) => void
  onSaveProfile: () => void
  onDeleteProfile: () => void
  onSelectTlsFile: (kind: TlsFileKind) => Promise<string | null>
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
  profiles,
  selectedProfileId,
  onChange,
  onConnect,
  onDisconnect,
  onSelectProfile,
  onSaveProfile,
  onDeleteProfile,
  onSelectTlsFile
}: ConnectionPanelProps) {
  const update = <Key extends keyof ConnectionConfig>(
    key: Key,
    value: ConnectionConfig[Key]
  ): void => onChange({ ...config, [key]: value })

  const changeProtocol = (protocol: MqttProtocol): void => {
    onChange({ ...config, protocol, port: defaultPorts[protocol] })
  }

  const chooseTlsFile = async (
    field: 'caPath' | 'clientCertificatePath' | 'clientKeyPath',
    kind: TlsFileKind
  ): Promise<void> => {
    const path = await onSelectTlsFile(kind)
    if (path) update(field, path)
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

      <div className="profile-controls">
        <select
          aria-label="Saved broker profile"
          value={selectedProfileId}
          disabled={connected || connecting || busy}
          onChange={(event) => onSelectProfile(event.target.value)}
        >
          <option value="">New unsaved profile</option>
          {profiles.map((profile) => (
            <option value={profile.id} key={profile.id}>{profile.config.name}</option>
          ))}
        </select>
        <button type="button" disabled={busy || !config.name.trim()} onClick={onSaveProfile}>
          Save
        </button>
        <button type="button" disabled={busy || !selectedProfileId} onClick={onDeleteProfile}>
          Delete
        </button>
      </div>

      <div className="field-grid">
        <label className="field profile-name-field">
          <span>Profile name</span>
          <input
            value={config.name}
            disabled={connected || connecting}
            placeholder="Local broker"
            onChange={(event) => update('name', event.target.value)}
          />
        </label>
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
          {isDesktop && (config.protocol === 'mqtts' || config.protocol === 'wss') && (
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
          {isDesktop && (config.protocol === 'mqtts' || config.protocol === 'wss') && (
            <div className="tls-settings">
              <span className="tls-heading">mTLS certificates</span>
              <div className="tls-file-row">
                <label className="field">
                  <span>Custom CA</span>
                  <input readOnly value={config.caPath} placeholder="Use system trust store" />
                </label>
                <button type="button" disabled={connected || connecting} onClick={() => void chooseTlsFile('caPath', 'ca')}>Select</button>
                {config.caPath && <button type="button" disabled={connected || connecting} onClick={() => update('caPath', '')}>Clear</button>}
              </div>
              <div className="tls-file-row">
                <label className="field">
                  <span>Client certificate</span>
                  <input readOnly value={config.clientCertificatePath} placeholder="Optional PEM or CRT" />
                </label>
                <button type="button" disabled={connected || connecting} onClick={() => void chooseTlsFile('clientCertificatePath', 'certificate')}>Select</button>
                {config.clientCertificatePath && <button type="button" disabled={connected || connecting} onClick={() => update('clientCertificatePath', '')}>Clear</button>}
              </div>
              <div className="tls-file-row">
                <label className="field">
                  <span>Client private key</span>
                  <input readOnly value={config.clientKeyPath} placeholder="Optional KEY or PEM" />
                </label>
                <button type="button" disabled={connected || connecting} onClick={() => void chooseTlsFile('clientKeyPath', 'key')}>Select</button>
                {config.clientKeyPath && <button type="button" disabled={connected || connecting} onClick={() => update('clientKeyPath', '')}>Clear</button>}
              </div>
              <label className="field">
                <span>Private key passphrase</span>
                <input
                  type="password"
                  value={config.clientKeyPassphrase}
                  disabled={connected || connecting}
                  placeholder="Optional · stored securely with profile"
                  onChange={(event) => update('clientKeyPassphrase', event.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      </details>

      <button
        className={`primary-button ${connected ? 'disconnect-button' : ''}`}
        type={connected ? 'button' : 'submit'}
        disabled={busy}
        onClick={connected ? onDisconnect : undefined}
      >
        <PlugIcon />
        {connecting ? 'Connecting…' : connected ? 'Disconnect' : 'Connect'}
      </button>
    </form>
  )
}
