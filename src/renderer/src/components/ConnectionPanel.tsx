import type { FormEvent } from 'react'
import type {
  BrokerProfile,
  ConnectionConfig,
  MqttProtocol,
  MqttQos,
  MqttWillPayloadFormat,
  TlsFileKind
} from '../../../shared/contracts'
import { defaultMqttLastWill } from '../../../shared/mqtt-will'
import { PlugIcon, PowerIcon } from './icons'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../lib/i18n'

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

const protocolGuideKeys: Record<MqttProtocol, TranslationKey> = {
  mqtt: 'connection.protocolGuide.mqtt',
  mqtts: 'connection.protocolGuide.mqtts',
  ws: 'connection.protocolGuide.ws',
  wss: 'connection.protocolGuide.wss'
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
  const will = config.will ?? defaultMqttLastWill()
  const updateWill = <Key extends keyof typeof will>(
    key: Key,
    value: (typeof will)[Key]
  ): void => onChange({ ...config, will: { ...will, [key]: value } })

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
    <form className="panel" onSubmit={submit}>
      <div className="panel-head">
        <h2>{t('connection.title')}</h2>
        <span className="badge">{t(isDesktop ? 'mode.desktop' : 'mode.webLite')}</span>
      </div>

      <div className="panel-body">
        <div className="profile-row">
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
          <button
            className="btn ghost sm"
            type="button"
            disabled={busy || !config.name.trim()}
            onClick={onSaveProfile}
          >
            {t('common.save')}
          </button>
          <button
            className="btn ghost sm"
            type="button"
            disabled={busy || !selectedProfileId}
            onClick={onDeleteProfile}
          >
            {t('common.delete')}
          </button>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>{t('connection.profileName')}</span>
            <input
              value={config.name}
              disabled={connected || connecting}
              placeholder={t('connection.localBroker')}
              onChange={(event) => update('name', event.target.value)}
            />
          </label>

          <div className="row-3">
            <label className="field">
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

            <label className="field">
              <span>{t('connection.host')}</span>
              <input
                className="mono"
                value={config.host}
                disabled={connected || connecting}
                placeholder="broker.example.com"
                spellCheck={false}
                onChange={(event) => update('host', event.target.value)}
              />
            </label>

            <label className="field">
              <span>{t('connection.port')}</span>
              <input
                className="mono"
                type="number"
                min="1"
                max="65535"
                value={config.port}
                disabled={connected || connecting}
                onChange={(event) => update('port', Number(event.target.value))}
              />
            </label>
          </div>

          <div className="protocol-guide" role="note" aria-live="polite">
            <strong>{t(protocolGuideKeys[config.protocol])}</strong>
            <span>{t('connection.portGuidance')}</span>
            {!isDesktop && <span>{t('connection.webLiteTransport')}</span>}
          </div>

          {(config.protocol === 'ws' || config.protocol === 'wss') && (
            <label className="field">
              <span>{t('connection.path')}</span>
              <input
                className="mono"
                value={config.path}
                disabled={connected || connecting}
                placeholder="mqtt"
                spellCheck={false}
                onChange={(event) => update('path', event.target.value)}
              />
            </label>
          )}

          <div className="row-2">
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
        </div>

        <details className="advanced">
          <summary>{t('connection.advanced')}</summary>
          <div className="field-grid">
            <label className="field">
              <span>{t('connection.clientId')}</span>
              <input
                className="mono"
                value={config.clientId}
                disabled={connected || connecting}
                spellCheck={false}
                onChange={(event) => update('clientId', event.target.value)}
              />
            </label>
            <div className="row-2">
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
                  className="mono"
                  type="number"
                  min="0"
                  value={config.keepalive}
                  disabled={connected || connecting}
                  onChange={(event) => update('keepalive', Number(event.target.value))}
                />
              </label>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={config.clean}
                disabled={connected || connecting}
                onChange={(event) => update('clean', event.target.checked)}
              />
              <span>{t('connection.cleanSession')}</span>
            </label>
            <section className={`will-group ${will.enabled ? 'enabled' : ''}`}>
              <div className="will-group-head">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={will.enabled}
                    disabled={connected || connecting}
                    onChange={(event) => updateWill('enabled', event.target.checked)}
                  />
                  <span>{t('connection.willEnabled')}</span>
                </label>
                <span className="tag">LWT</span>
              </div>
              <p>{t('connection.willHelp')}</p>
              {will.enabled && (
                <div className="will-fields">
                  <label className="field">
                    <span>{t('connection.willTopic')}</span>
                    <input
                      className="mono"
                      value={will.topic}
                      disabled={connected || connecting}
                      placeholder="devices/gateway/status"
                      spellCheck={false}
                      onChange={(event) => updateWill('topic', event.target.value)}
                    />
                  </label>
                  <div className="will-options">
                    <label className="field">
                      <span>{t('connection.willPayloadFormat')}</span>
                      <select
                        value={will.payloadFormat}
                        disabled={connected || connecting}
                        onChange={(event) => updateWill(
                          'payloadFormat',
                          event.target.value as MqttWillPayloadFormat
                        )}
                      >
                        <option value="text">UTF-8</option>
                        <option value="hex">Hex</option>
                        <option value="base64">Base64</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>{t('connection.willQos')}</span>
                      <select
                        value={will.qos}
                        disabled={connected || connecting}
                        onChange={(event) => updateWill('qos', Number(event.target.value) as MqttQos)}
                      >
                        <option value={0}>QoS 0</option>
                        <option value={1}>QoS 1</option>
                        <option value={2}>QoS 2</option>
                      </select>
                    </label>
                    <label className="checkbox will-retain">
                      <input
                        type="checkbox"
                        checked={will.retain}
                        disabled={connected || connecting}
                        onChange={(event) => updateWill('retain', event.target.checked)}
                      />
                      <span>{t('connection.willRetain')}</span>
                    </label>
                  </div>
                  <label className="field">
                    <span>{t('connection.willPayload')}</span>
                    <textarea
                      className="mono"
                      rows={3}
                      value={will.payload}
                      disabled={connected || connecting}
                      placeholder={will.payloadFormat === 'text'
                        ? '{ "online": false }'
                        : will.payloadFormat === 'hex'
                          ? 'DE AD BE EF'
                          : '3q2+7w=='}
                      spellCheck={false}
                      onChange={(event) => updateWill('payload', event.target.value)}
                    />
                  </label>
                  {config.mqttVersion === 5 && (
                    <>
                      <div className="row-2">
                        <label className="field">
                          <span>{t('connection.willDelay')}</span>
                          <input
                            className="mono"
                            type="number"
                            min="0"
                            max="4294967295"
                            value={will.willDelayInterval ?? ''}
                            disabled={connected || connecting}
                            placeholder="0"
                            onChange={(event) => updateWill(
                              'willDelayInterval',
                              event.target.value === '' ? undefined : Number(event.target.value)
                            )}
                          />
                        </label>
                        <label className="field">
                          <span>{t('connection.willExpiry')}</span>
                          <input
                            className="mono"
                            type="number"
                            min="0"
                            max="4294967295"
                            value={will.messageExpiryInterval ?? ''}
                            disabled={connected || connecting}
                            placeholder={t('common.optional')}
                            onChange={(event) => updateWill(
                              'messageExpiryInterval',
                              event.target.value === '' ? undefined : Number(event.target.value)
                            )}
                          />
                        </label>
                      </div>
                      <label className="field">
                        <span>{t('connection.willContentType')}</span>
                        <input
                          className="mono"
                          value={will.contentType ?? ''}
                          disabled={connected || connecting}
                          placeholder="application/json"
                          spellCheck={false}
                          onChange={(event) => updateWill(
                            'contentType',
                            event.target.value || undefined
                          )}
                        />
                      </label>
                    </>
                  )}
                  <p className="will-storage-note">
                    {t(isDesktop ? 'connection.willStorageDesktop' : 'connection.willStorageWeb')}
                  </p>
                </div>
              )}
            </section>
            {isDesktop && (config.protocol === 'mqtts' || config.protocol === 'wss') && (
              <label className="checkbox">
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
              <div className="tls-group">
                <span className="group-label">{t('connection.mtls')}</span>
                <div className="tls-row">
                  <label className="field">
                    <span>{t('connection.customCa')}</span>
                    <input className="mono" readOnly value={config.caPath} placeholder={t('connection.systemTrust')} />
                  </label>
                  <button className="btn ghost sm" type="button" disabled={connected || connecting} onClick={() => void chooseTlsFile('caPath', 'ca')}>{t('common.select')}</button>
                  {config.caPath && <button className="btn ghost sm" type="button" disabled={connected || connecting} onClick={() => update('caPath', '')}>{t('common.clear')}</button>}
                </div>
                <div className="tls-row">
                  <label className="field">
                    <span>{t('connection.clientCertificate')}</span>
                    <input className="mono" readOnly value={config.clientCertificatePath} placeholder={t('connection.optionalCertificate')} />
                  </label>
                  <button className="btn ghost sm" type="button" disabled={connected || connecting} onClick={() => void chooseTlsFile('clientCertificatePath', 'certificate')}>{t('common.select')}</button>
                  {config.clientCertificatePath && <button className="btn ghost sm" type="button" disabled={connected || connecting} onClick={() => update('clientCertificatePath', '')}>{t('common.clear')}</button>}
                </div>
                <div className="tls-row">
                  <label className="field">
                    <span>{t('connection.clientKey')}</span>
                    <input className="mono" readOnly value={config.clientKeyPath} placeholder={t('connection.optionalKey')} />
                  </label>
                  <button className="btn ghost sm" type="button" disabled={connected || connecting} onClick={() => void chooseTlsFile('clientKeyPath', 'key')}>{t('common.select')}</button>
                  {config.clientKeyPath && <button className="btn ghost sm" type="button" disabled={connected || connecting} onClick={() => update('clientKeyPath', '')}>{t('common.clear')}</button>}
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
          className={`btn block ${connected ? 'danger' : 'primary'}`}
          type={connected ? 'button' : 'submit'}
          disabled={busy}
          onClick={connected ? onDisconnect : undefined}
        >
          {connected ? <PowerIcon width={16} height={16} /> : <PlugIcon width={16} height={16} />}
          {t(connecting ? 'connection.connecting' : connected ? 'connection.disconnect' : 'connection.connect')}
        </button>
      </div>
    </form>
  )
}
