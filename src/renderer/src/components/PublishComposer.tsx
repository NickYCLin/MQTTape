import { useMemo, useRef, useState, type FormEvent } from 'react'
import type {
  MqttCorrelationDataFormat,
  MqttPayloadFormatInput,
  MqttPublishPropertiesDraftError
} from '../../../shared/mqtt-publish-properties'
import { buildMqttPublishProperties } from '../../../shared/mqtt-publish-properties'
import type {
  MqttPublishProperties,
  MqttQos,
  MqttUserProperty,
  MqttVersion
} from '../../../shared/contracts'
import { DownlinkIcon, SendIcon } from './icons'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../lib/i18n'
import { LoRaWanDownlinkDialog } from './LoRaWanDownlinkDialog'

interface PublishComposerProps {
  connected: boolean
  mqttVersion: MqttVersion
  onPublish: (
    topic: string,
    payload: string,
    qos: MqttQos,
    retain: boolean,
    properties?: MqttPublishProperties
  ) => Promise<boolean>
}

interface EditableUserProperty extends MqttUserProperty {
  id: number
}

const propertyErrorKeys: Record<MqttPublishPropertiesDraftError, TranslationKey> = {
  'message-expiry-invalid': 'publish.propertiesError.expiry',
  'response-topic-invalid': 'publish.propertiesError.responseTopic',
  'correlation-hex-invalid': 'publish.propertiesError.correlationHex',
  'correlation-base64-invalid': 'publish.propertiesError.correlationBase64'
}

const correlationPlaceholderKeys: Record<MqttCorrelationDataFormat, TranslationKey> = {
  text: 'publish.propertiesCorrelationPlaceholder.text',
  hex: 'publish.propertiesCorrelationPlaceholder.hex',
  base64: 'publish.propertiesCorrelationPlaceholder.base64'
}

export function PublishComposer({ connected, mqttVersion, onPublish }: PublishComposerProps) {
  const { t, translateMessage } = useI18n()
  const [topic, setTopic] = useState('')
  const [payload, setPayload] = useState('')
  const [qos, setQos] = useState<MqttQos>(0)
  const [retain, setRetain] = useState(false)
  const [payloadFormat, setPayloadFormat] = useState<MqttPayloadFormatInput>('unspecified')
  const [messageExpiryInterval, setMessageExpiryInterval] = useState('')
  const [responseTopic, setResponseTopic] = useState('')
  const [correlationDataFormat, setCorrelationDataFormat] =
    useState<MqttCorrelationDataFormat>('text')
  const [correlationData, setCorrelationData] = useState('')
  const [contentType, setContentType] = useState('')
  const [userProperties, setUserProperties] = useState<EditableUserProperty[]>([])
  const nextUserPropertyId = useRef(1)
  const [showLoRaWanDownlink, setShowLoRaWanDownlink] = useState(false)
  const mqtt5Enabled = mqttVersion === 5
  const propertyResult = useMemo(() => buildMqttPublishProperties({
    payloadFormat,
    messageExpiryInterval,
    responseTopic,
    correlationDataFormat,
    correlationData,
    userProperties,
    contentType
  }), [
    contentType,
    correlationData,
    correlationDataFormat,
    messageExpiryInterval,
    payloadFormat,
    responseTopic,
    userProperties
  ])
  const propertyError = propertyResult.ok
    ? ''
    : `${t(propertyErrorKeys[propertyResult.error])}${propertyResult.detail
      ? ` ${translateMessage(propertyResult.detail)}`
      : ''}`

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (mqtt5Enabled && !propertyResult.ok) return
    await onPublish(
      topic,
      payload,
      qos,
      retain,
      mqtt5Enabled && propertyResult.ok ? propertyResult.properties : undefined
    )
  }

  const addUserProperty = (): void => {
    setUserProperties((current) => [
      ...current,
      { id: nextUserPropertyId.current++, name: '', value: '' }
    ])
  }

  const updateUserProperty = (
    id: number,
    field: keyof MqttUserProperty,
    value: string
  ): void => {
    setUserProperties((current) => current.map((property) =>
      property.id === id ? { ...property, [field]: value } : property
    ))
  }

  return (
    <>
      <form className="publish" onSubmit={submit}>
        <div className="publish-head">
          <h2>{t('publish.eyebrow')}</h2>
          <div className="publish-options">
            <button className="btn plain sm" type="button" onClick={() => setShowLoRaWanDownlink(true)}>
              <DownlinkIcon width={14} height={14} />
              {t('publish.lorawanDownlink')}
            </button>
            <select
              aria-label={t('publish.qos')}
              value={qos}
              disabled={!connected}
              onChange={(event) => setQos(Number(event.target.value) as MqttQos)}
            >
              <option value={0}>QoS 0</option>
              <option value={1}>QoS 1</option>
              <option value={2}>QoS 2</option>
            </select>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={retain}
                disabled={!connected}
                onChange={(event) => setRetain(event.target.checked)}
              />
              <span>{t('publish.retain')}</span>
            </label>
          </div>
        </div>
        <div className="publish-body">
          <input
            className="mono"
            aria-label={t('publish.topic')}
            value={topic}
            disabled={!connected}
            placeholder={t('publish.topicPlaceholder')}
            spellCheck={false}
            onChange={(event) => setTopic(event.target.value)}
          />
          <textarea
            className="mono"
            aria-label={t('publish.payload')}
            value={payload}
            disabled={!connected}
            placeholder={t('publish.payloadPlaceholder')}
            spellCheck={false}
            onChange={(event) => setPayload(event.target.value)}
          />
          <button
            className="btn primary"
            type="submit"
            disabled={!connected || !topic.trim() || (mqtt5Enabled && !propertyResult.ok)}
          >
            <SendIcon width={16} height={16} />
            {t('publish.action')}
          </button>
        </div>

        <details className="publish-properties">
          <summary>
            <span>{t('publish.propertiesTitle')}</span>
            <small className={`tag ${mqtt5Enabled ? 'mqtt5-ready' : ''}`}>
              {t(mqtt5Enabled ? 'publish.propertiesAvailable' : 'publish.propertiesRequiresMqtt5')}
            </small>
          </summary>
          <div className="publish-properties-body">
            <p className="hint">{t('publish.propertiesHelp')}</p>
            {!mqtt5Enabled && (
              <div className="notice info" role="note">
                <strong>{t('publish.propertiesRequiresMqtt5')}</strong>
                <span>{t('publish.propertiesMqtt311Help')}</span>
              </div>
            )}

            <div className="publish-property-grid">
              <label className="field">
                <span>{t('mqtt5.payloadFormat')}</span>
                <select
                  value={payloadFormat}
                  disabled={!connected || !mqtt5Enabled}
                  onChange={(event) => setPayloadFormat(event.target.value as MqttPayloadFormatInput)}
                >
                  <option value="unspecified">{t('publish.propertiesUnspecified')}</option>
                  <option value="utf8">{t('mqtt5.payloadFormatUtf8')}</option>
                  <option value="bytes">{t('mqtt5.payloadFormatBytes')}</option>
                </select>
              </label>
              <label className="field">
                <span>{t('mqtt5.messageExpiry')}</span>
                <input
                  inputMode="numeric"
                  value={messageExpiryInterval}
                  disabled={!connected || !mqtt5Enabled}
                  placeholder={t('publish.propertiesExpiryPlaceholder')}
                  onChange={(event) => setMessageExpiryInterval(event.target.value)}
                />
              </label>
              <label className="field">
                <span>{t('mqtt5.contentType')}</span>
                <input
                  value={contentType}
                  disabled={!connected || !mqtt5Enabled}
                  placeholder="application/json"
                  onChange={(event) => setContentType(event.target.value)}
                />
              </label>
              <label className="field">
                <span>{t('mqtt5.responseTopic')}</span>
                <input
                  className="mono"
                  value={responseTopic}
                  disabled={!connected || !mqtt5Enabled}
                  placeholder="devices/replies"
                  spellCheck={false}
                  onChange={(event) => setResponseTopic(event.target.value)}
                />
              </label>
            </div>

            <div className="correlation-row">
              <label className="field correlation-format">
                <span>{t('publish.propertiesCorrelationFormat')}</span>
                <select
                  value={correlationDataFormat}
                  disabled={!connected || !mqtt5Enabled}
                  onChange={(event) =>
                    setCorrelationDataFormat(event.target.value as MqttCorrelationDataFormat)}
                >
                  <option value="text">{t('publish.propertiesFormatText')}</option>
                  <option value="hex">{t('publish.propertiesFormatHex')}</option>
                  <option value="base64">Base64</option>
                </select>
              </label>
              <label className="field">
                <span>{t('mqtt5.correlationData')}</span>
                <input
                  className="mono"
                  value={correlationData}
                  disabled={!connected || !mqtt5Enabled}
                  placeholder={t(correlationPlaceholderKeys[correlationDataFormat])}
                  spellCheck={false}
                  onChange={(event) => setCorrelationData(event.target.value)}
                />
              </label>
            </div>

            <div className="publish-user-properties">
              <div className="publish-user-properties-head">
                <strong>{t('mqtt5.userProperties')}</strong>
                <button
                  className="btn ghost sm"
                  type="button"
                  disabled={!connected || !mqtt5Enabled}
                  onClick={addUserProperty}
                >
                  {t('publish.propertiesAddUserProperty')}
                </button>
              </div>
              {userProperties.map((property, index) => (
                <div className="publish-user-property" key={property.id}>
                  <label className="field">
                    <span>{t('mqtt5.userPropertyName')}</span>
                    <input
                      value={property.name}
                      disabled={!connected || !mqtt5Enabled}
                      aria-label={`${t('mqtt5.userPropertyName')} ${index + 1}`}
                      onChange={(event) =>
                        updateUserProperty(property.id, 'name', event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>{t('mqtt5.userPropertyValue')}</span>
                    <input
                      value={property.value}
                      disabled={!connected || !mqtt5Enabled}
                      aria-label={`${t('mqtt5.userPropertyValue')} ${index + 1}`}
                      onChange={(event) =>
                        updateUserProperty(property.id, 'value', event.target.value)}
                    />
                  </label>
                  <button
                    className="btn plain sm"
                    type="button"
                    disabled={!connected || !mqtt5Enabled}
                    aria-label={t('publish.propertiesRemoveUserProperty', { count: index + 1 })}
                    onClick={() => setUserProperties((current) =>
                      current.filter((candidate) => candidate.id !== property.id))}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </div>

            <p className="hint">{t('publish.propertiesReceiveOnlyHelp')}</p>
            {mqtt5Enabled && propertyError && (
              <p className="feedback invalid" role="alert">{propertyError}</p>
            )}
          </div>
        </details>
      </form>
      {showLoRaWanDownlink && (
        <LoRaWanDownlinkDialog
          connected={connected}
          onPublish={onPublish}
          onClose={() => setShowLoRaWanDownlink(false)}
        />
      )}
    </>
  )
}
