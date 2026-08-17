import {
  SPARKPLUG_SCHEMA_SOURCE_URL,
  sparkplugTimestampDate,
  type SparkplugInspection,
  type SparkplugMetric
} from '../../../shared/sparkplug'
import { PayloadTree } from './PayloadTree'
import { useI18n } from '../i18n'

interface SparkplugInspectorProps {
  inspection: SparkplugInspection
}

function metricValue(metric: SparkplugMetric): string {
  if (metric.isNull) return 'null'
  const value = metric.value
  if (value === undefined) return '—'
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Uint8Array) return `${value.byteLength} B`
  return '[…]'
}

function flags(metric: SparkplugMetric, historical: string, transient: string): string {
  return [
    metric.isHistorical ? historical : undefined,
    metric.isTransient ? transient : undefined,
    metric.isNull ? 'NULL' : undefined
  ].filter(Boolean).join(' · ') || '—'
}

export function SparkplugInspector({ inspection }: SparkplugInspectorProps) {
  const { t, formatDateTime, formatNumber } = useI18n()
  const payloadTimestamp = sparkplugTimestampDate(inspection.timestamp)
  const metadata = [
    [t('payload.sparkplugGroup'), inspection.topic.groupId],
    [t('payload.sparkplugMessageType'), inspection.topic.messageType],
    [t('payload.sparkplugEdgeNode'), inspection.topic.edgeNodeId],
    [t('payload.sparkplugDevice'), inspection.topic.deviceId],
    [t('payload.sparkplugSequence'), inspection.sequence?.toString()],
    [t('payload.sparkplugTimestamp'), payloadTimestamp
      ? formatDateTime(payloadTimestamp.toISOString())
      : inspection.timestamp?.toString()],
    ['UUID', inspection.uuid]
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string')

  return (
    <div className="structured-payload sparkplug-inspector" role="tabpanel">
      <div className="structured-payload-head">
        <div>
          <span className="eyebrow">{t('payload.sparkplugDetected')}</span>
          <h3>Sparkplug B</h3>
          <p>{t('payload.sparkplugHelp')}</p>
        </div>
        <div className="structured-payload-tags">
          <span className="tag accent">spBv1.0</span>
          <span className="tag">{inspection.topic.messageType}</span>
        </div>
      </div>

      <dl className="sparkplug-meta">
        {metadata.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="mono" title={value}>{value}</dd>
          </div>
        ))}
      </dl>

      {inspection.status === 'decoded' ? (
        <>
          <section className="sparkplug-metrics">
            <div className="sparkplug-section-head">
              <h4>{t('payload.sparkplugMetrics')}</h4>
              <span className="tag">{formatNumber(inspection.metrics.length)}</span>
            </div>
            {inspection.metrics.length === 0
              ? <p className="protobuf-empty">{t('payload.sparkplugNoMetrics')}</p>
              : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t('payload.sparkplugMetric')}</th>
                          <th>{t('payload.sparkplugAlias')}</th>
                          <th>{t('payload.sparkplugDatatype')}</th>
                          <th>{t('payload.sparkplugValue')}</th>
                          <th>{t('payload.sparkplugFlags')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspection.metrics.map((metric, index) => (
                          <tr key={`${metric.name ?? metric.alias?.toString() ?? 'metric'}-${index}`}>
                            <td className="mono">{metric.name ?? '—'}</td>
                            <td className="mono">{metric.alias?.toString() ?? '—'}</td>
                            <td>{metric.datatypeName}</td>
                            <td className="mono sparkplug-value" title={metricValue(metric)}>{metricValue(metric)}</td>
                            <td>{flags(
                              metric,
                              t('payload.sparkplugHistorical'),
                              t('payload.sparkplugTransient')
                            )}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
          </section>
          {inspection.tree && (
            <section className="sparkplug-tree">
              <div className="sparkplug-section-head"><h4>{t('payload.sparkplugFullPayload')}</h4></div>
              <PayloadTree tree={inspection.tree} />
            </section>
          )}
        </>
      ) : (
        <div className="structured-payload-error" role="alert">
          <strong>{t(inspection.status === 'too-large'
            ? 'payload.decoderTooLarge'
            : 'payload.decoderInvalid', { format: 'Sparkplug B' })}</strong>
          {inspection.error && <code>{inspection.error}</code>}
        </div>
      )}

      <p className="sparkplug-source">
        {t('payload.sparkplugSchemaSource')}{' '}
        <a href={SPARKPLUG_SCHEMA_SOURCE_URL} target="_blank" rel="noreferrer">Eclipse Tahu</a>
        {' · '}EPL-2.0
      </p>
    </div>
  )
}
