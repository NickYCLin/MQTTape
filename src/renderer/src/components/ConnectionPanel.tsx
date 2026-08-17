import type { FormEvent } from 'react'
import type {
  BrokerProfile,
  ConnectionConfig,
  MqttProtocol,
  TlsFileKind
} from '../../../shared/contracts'
import { PlugIcon } from './icons'
import { useI18n } from '../i18n'

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
  const { t } = useI18n()
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
          <span className="eyebrow">{t('connection.eyebrow')}</span>
          <h2>{t('connection.title')}</h2>
        </div>
        <span className="mode-badge">{t(isDesktop ? 'mode.desktop' : 'mode.webLite')}</span>
      </div>

      <div className="profile-controls">
        <select
          aria-label={t('connection.savedProfile')}
          value={selectedProfileId}
          disabled={connected || connecting || busy}
          onChange={(event) => onSelectProfile(event.target.value)}
        >
          <option value="">{t('connection.newProfile')}</option>
          {profiles.map((profile) => (
            <option value={profile.id} key={profile.id}>{profile.config.name}</option>
          ))}
        </select>
        <button type="button" disabled={busy || !config.name.trim()} onClick={onSaveProfile}>
          {t('common.save')}
        </button>
        <button type="button" disabled={busy || !selectedProfileId} onClick={onDeleteProfile}>
          {t('common.delete')}
        </button>
      </div>

      <div className="field-grid">
        <label className="field profile-name-field">
          <span>{t('connection.profileName')}</span>
          <input
            value={config.name}
            disabled={connected || connecting}
            placeholder={t('connection.localBroker')}
            onChange={(event) => update('name', event.target.value)}
          />
        </label>
        <label className="field protocol-field">
          <span>{t('connection.protocol')}</span>
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
          <span>{t('connection.host')}</span>
          <input
            value={config.host}
            disabled={connected || connecting}
            placeholder="broker.example.com"
            spellCheck={false}
            onChange={(event) => update('host', event.target.value)}
          />
        </label>

        <label className="field port-field">
          <span>{t('connection.port')}</span>
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
            <span>{t('connection.path')}</span>
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
          <span>{t('connection.username')}</span>
          <input
            value={config.username}
            disabled={connected || connecting}
            autoComplete="username"
            placeholder={t('common.optional')}
            onChange={(event) => update('username', event.target.value)}
          />
        </label>

        <label className="field">
          <span>{t('connection.password')}</span>
          <input
            type="password"
            value={config.password}
            disabled={connected || connecting}
            autoComplete="current-password"
            placeholder={t('connection.notStored')}
            onChange={(event) => update('password', event.target.value)}
          />
        </label>
      </div>

      <details className="advanced-settings">
        <summary>{t('connection.advanced')}</summary>
        <div className="field-grid advanced-grid">
          <label className="field">
            <span>{t('connection.clientId')}</span>
            <input
              value={config.clientId}
              disabled={connected || connecting}
              spellCheck={false}
              onChange={(event) => update('clientId', event.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('connection.mqttVersion')}</span>
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
            <span>{t('connection.keepAlive')}</span>
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
            <span>{t('connection.cleanSession')}</span>
          </label>
          {isDesktop && (config.protocol === 'mqtts' || config.protocol === 'wss') && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={config.rejectUnauthorized}
                disabled={connected || connecting}
                onChange={(event) => update('rejectUnauthorized', event.target.checked)}
              />
              <span>{t('connection.verifyTls')}</span>
            </label>
          )}
          {isDesktop && (config.protocol === 'mqtts' || config.protocol === 'wss') && (
            <div className="tls-settings">
              <span className="tls-heading">{t('connection.mtls')}</span>
              <div className="tls-file-row">
                <label className="field">
                  <span>{t('connection.customCa')}</span>
                  <input readOnly value={config.caPath} placeholder={t('connection.systemTrust')} />
                </label>
                <button type="button" disabled={connected || connecting} onClick={() => void chooseTlsFile('caPath', 'ca')}>{t('common.select')}</button>
                {config.caPath && <button type="button" disabled={connected || connecting} onClick={() => update('caPath', '')}>{t('common.clear')}</button>}
              </div>
              <div className="tls-file-row">
                <label className="field">
                  <span>{t('connection.clientCertificate')}</span>
                  <input readOnly value={config.clientCertificatePath} placeholder={t('connection.optionalCertificate')} />
                </label>
                <button type="button" disabled={connected || connecting} onClick={() => void chooseTlsFile('clientCertificatePath', 'certificate')}>{t('common.select')}</button>
                {config.clientCertificatePath && <button type="button" disabled={connected || connecting} onClick={() => update('clientCertificatePath', '')}>{t('common.clear')}</button>}
              </div>
              <div className="tls-file-row">
                <label className="field">
                  <span>{t('connection.clientKey')}</span>
                  <input readOnly value={config.clientKeyPath} placeholder={t('connection.optionalKey')} />
                </label>
                <button type="button" disabled={connected || connecting} onClick={() => void chooseTlsFile('clientKeyPath', 'key')}>{t('common.select')}</button>
                {config.clientKeyPath && <button type="button" disabled={connected || connecting} onClick={() => update('clientKeyPath', '')}>{t('common.clear')}</button>}
              </div>
              <label className="field">
                <span>{t('connection.keyPassphrase')}</span>
                <input
                  type="password"
                  value={config.clientKeyPassphrase}
                  disabled={connected || connecting}
                  placeholder={t('connection.securePassphrase')}
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
        {t(connecting ? 'connection.connecting' : connected ? 'connection.disconnect' : 'connection.connect')}
      </button>
    </form>
  )
}
