import { useMemo, useState, type FormEvent } from 'react'
import type { MqttQos } from '../../../shared/contracts'
import {
  buildLoRaWanDownlink,
  createLoRaWanCorrelationId,
  type LoRaWanDownlinkError,
  type LoRaWanDownlinkPayloadFormat,
  type LoRaWanDownlinkProvider,
  type TheThingsStackDownlinkOperation,
  type TheThingsStackDownlinkPriority
} from '../../../shared/lorawan-downlink'
import type { TranslationKey } from '../lib/i18n'
import { useI18n } from '../i18n'
import { SendIcon, XIcon } from './icons'

interface LoRaWanDownlinkDialogProps {
  connected: boolean
  onPublish: (topic: string, payload: string, qos: MqttQos, retain: boolean) => Promise<boolean>
  onClose: () => void
}

const priorities: TheThingsStackDownlinkPriority[] = [
  'LOWEST',
  'LOW',
  'BELOW_NORMAL',
  'NORMAL',
  'ABOVE_NORMAL',
  'HIGH',
  'HIGHEST'
]

const errorKeys: Record<LoRaWanDownlinkError, TranslationKey> = {
  'application-id-required': 'lorawan.downlink.error.applicationRequired',
  'application-id-invalid': 'lorawan.downlink.error.applicationInvalid',
  'device-id-required': 'lorawan.downlink.error.deviceRequired',
  'device-id-invalid': 'lorawan.downlink.error.deviceInvalid',
  'tenant-id-invalid': 'lorawan.downlink.error.tenantInvalid',
  'dev-eui-invalid': 'lorawan.downlink.error.devEuiInvalid',
  'f-port-invalid': 'lorawan.downlink.error.fPortInvalid',
  'payload-required': 'lorawan.downlink.error.payloadRequired',
  'hex-invalid': 'lorawan.downlink.error.hexInvalid',
  'base64-invalid': 'lorawan.downlink.error.base64Invalid',
  'json-invalid': 'lorawan.downlink.error.jsonInvalid'
}

export function LoRaWanDownlinkDialog({
  connected,
  onPublish,
  onClose
}: LoRaWanDownlinkDialogProps) {
  const { t, formatNumber } = useI18n()
  const [provider, setProvider] = useState<LoRaWanDownlinkProvider>('the-things-stack')
  const [applicationId, setApplicationId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [fPort, setFPort] = useState('1')
  const [confirmed, setConfirmed] = useState(false)
  const [payloadFormat, setPayloadFormat] = useState<LoRaWanDownlinkPayloadFormat>('hex')
  const [payload, setPayload] = useState('')
  const [operation, setOperation] = useState<TheThingsStackDownlinkOperation>('push')
  const [priority, setPriority] = useState<TheThingsStackDownlinkPriority>('NORMAL')
  const [qos, setQos] = useState<MqttQos>(0)
  const [correlationId] = useState(createLoRaWanCorrelationId)
  const [attempted, setAttempted] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const result = useMemo(() => buildLoRaWanDownlink({
    provider,
    applicationId,
    deviceId,
    tenantId,
    fPort: Number(fPort),
    confirmed,
    payloadFormat,
    payload,
    operation,
    priority,
    correlationId: provider === 'the-things-stack' ? correlationId : undefined
  }), [
    applicationId,
    confirmed,
    correlationId,
    deviceId,
    fPort,
    operation,
    payload,
    payloadFormat,
    priority,
    provider,
    tenantId
  ])

  const hasStarted = Boolean(applicationId || deviceId || payload)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setAttempted(true)
    if (!connected || !result.ok) return

    setPublishing(true)
    try {
      if (await onPublish(result.publication.topic, result.publication.payload, qos, false)) {
        onClose()
      }
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="backdrop">
      <form
        className="dialog wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lorawan-downlink-title"
        onSubmit={submit}
      >
        <header className="dialog-head">
          <div className="dialog-title">
            <span className="eyebrow">{t('lorawan.downlink.eyebrow')}</span>
            <h2 id="lorawan-downlink-title">{t('lorawan.downlink.title')}</h2>
          </div>
          <button className="btn plain icon" type="button" aria-label={t('common.close')} onClick={onClose}>
            <XIcon width={16} height={16} />
          </button>
        </header>

        <div className="dialog-body">
          <p className="hint">{t('lorawan.downlink.help')}</p>

          <div className="downlink-fields">
            <label className="field">
              <span>{t('lorawan.downlink.provider')}</span>
              <select
                value={provider}
                onChange={(event) => {
                  setProvider(event.target.value as LoRaWanDownlinkProvider)
                  setAttempted(false)
                }}
              >
                <option value="the-things-stack">The Things Stack</option>
                <option value="chirpstack">ChirpStack</option>
              </select>
            </label>
            <label className="field">
              <span>{t('lorawan.downlink.applicationId')}</span>
              <input
                className="mono"
                value={applicationId}
                placeholder={provider === 'the-things-stack' ? 'field-station' : 'Application UUID'}
                spellCheck={false}
                onChange={(event) => setApplicationId(event.target.value)}
              />
            </label>
            {provider === 'the-things-stack' && (
              <label className="field">
                <span>{t('lorawan.downlink.tenantId')}</span>
                <input
                  className="mono"
                  value={tenantId}
                  placeholder={t('lorawan.downlink.tenantPlaceholder')}
                  spellCheck={false}
                  onChange={(event) => setTenantId(event.target.value)}
                />
              </label>
            )}
            <label className="field">
              <span>{t(provider === 'the-things-stack'
                ? 'lorawan.downlink.deviceId'
                : 'lorawan.downlink.devEui')}</span>
              <input
                className="mono"
                value={deviceId}
                placeholder={provider === 'the-things-stack' ? 'weather-node' : '0102030405060708'}
                spellCheck={false}
                onChange={(event) => setDeviceId(event.target.value)}
              />
            </label>
            <label className="field">
              <span>FPort</span>
              <input
                className="mono"
                type="number"
                min={1}
                max={provider === 'the-things-stack' ? 233 : 255}
                step={1}
                value={fPort}
                onChange={(event) => setFPort(event.target.value)}
              />
            </label>
            {provider === 'the-things-stack' && (
              <>
                <label className="field">
                  <span>{t('lorawan.downlink.operation')}</span>
                  <select
                    value={operation}
                    onChange={(event) => setOperation(event.target.value as TheThingsStackDownlinkOperation)}
                  >
                    <option value="push">{t('lorawan.downlink.operation.push')}</option>
                    <option value="replace">{t('lorawan.downlink.operation.replace')}</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t('lorawan.downlink.priority')}</span>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as TheThingsStackDownlinkPriority)}
                  >
                    {priorities.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </>
            )}
            <label className="field">
              <span>{t('publish.qos')}</span>
              <select value={qos} onChange={(event) => setQos(Number(event.target.value) as MqttQos)}>
                <option value={0}>QoS 0</option>
                <option value={1}>QoS 1</option>
                <option value={2}>QoS 2</option>
              </select>
            </label>
            <label className="checkbox aligned">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>{t('lorawan.downlink.confirmed')}</span>
            </label>
          </div>

          {provider === 'the-things-stack' && operation === 'replace' && (
            <div className="notice warn">
              <span>{t('lorawan.downlink.replaceWarning')}</span>
            </div>
          )}

          {provider === 'the-things-stack' && (
            <div className="notice info">
              <span>{t('lorawan.downlink.correlationHelp')}</span>
              <code className="mono">{correlationId}</code>
            </div>
          )}

          <section className="subpanel">
            <div className="subpanel-head">
              <label className="field compact">
                <span>{t('lorawan.downlink.payloadFormat')}</span>
                <select
                  value={payloadFormat}
                  onChange={(event) => {
                    setPayloadFormat(event.target.value as LoRaWanDownlinkPayloadFormat)
                    setPayload('')
                    setAttempted(false)
                  }}
                >
                  <option value="text">{t('lorawan.downlink.format.text')}</option>
                  <option value="hex">{t('lorawan.downlink.format.hex')}</option>
                  <option value="base64">Base64</option>
                  <option value="json">{t('lorawan.downlink.format.json')}</option>
                </select>
              </label>
              <small className="hint">{payloadFormat === 'json'
                ? t('lorawan.downlink.formatterNote')
                : t('lorawan.downlink.encodingNote')}</small>
            </div>
            <textarea
              className="mono downlink-payload"
              aria-label={t('lorawan.downlink.payload')}
              value={payload}
              placeholder={t(`lorawan.downlink.payloadPlaceholder.${payloadFormat}`)}
              spellCheck={false}
              onChange={(event) => setPayload(event.target.value)}
            />
          </section>

          {result.ok ? (
            <section className="subpanel preview-ok">
              <div className="subpanel-head">
                <h3>{t('lorawan.downlink.generated')}</h3>
                {result.publication.framePayloadBytes !== undefined && (
                  <span className="badge">{t('lorawan.downlink.frameSize', {
                    count: formatNumber(result.publication.framePayloadBytes)
                  })}</span>
                )}
              </div>
              <label className="field">
                <span>{t('lorawan.downlink.generatedTopic')}</span>
                <code className="code inline">{result.publication.topic}</code>
              </label>
              <label className="field">
                <span>{t('lorawan.downlink.generatedPayload')}</span>
                <pre className="code">{result.publication.payload}</pre>
              </label>
            </section>
          ) : (attempted || hasStarted) ? (
            <div className="notice error" role="alert">
              <span>{t(errorKeys[result.error])}</span>
            </div>
          ) : null}

          <p className="hint">{t('lorawan.downlink.safety')}</p>
        </div>

        <footer className="dialog-actions">
          <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn primary"
            type="submit"
            disabled={!connected || publishing || !result.ok}
            title={!connected ? t('lorawan.downlink.connectFirst') : undefined}
          >
            <SendIcon width={16} height={16} />
            {t(publishing ? 'lorawan.downlink.publishing' : 'lorawan.downlink.publish')}
          </button>
        </footer>
      </form>
    </div>
  )
}
