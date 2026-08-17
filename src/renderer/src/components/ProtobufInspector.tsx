import { useMemo, useState, type ChangeEvent } from 'react'
import {
  MAX_PROTOBUF_SCHEMA_FILES,
  MAX_STORED_PROTOBUF_SCHEMAS,
  inspectProtobufPayload,
  parseProtobufSchema,
  readProtobufSchemas,
  writeProtobufSchemas,
  type ProtobufSchemaFile,
  type StoredProtobufSchema
} from '../../../shared/protobuf'
import { PayloadTree } from './PayloadTree'
import { TrashIcon } from './icons'
import { useI18n } from '../i18n'

interface ProtobufInspectorProps {
  payloadBase64: string
  explicit: boolean
}

function schemaName(files: File[]): string {
  const first = files[0]?.name.replace(/\.proto$/i, '') || 'Protobuf'
  return files.length > 1 ? `${first} +${files.length - 1}` : first
}

function schemaIdentifier(): string {
  return globalThis.crypto?.randomUUID?.() ?? `schema-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ProtobufInspector({ payloadBase64, explicit }: ProtobufInspectorProps) {
  const { t, formatNumber } = useI18n()
  const [schemas, setSchemas] = useState<StoredProtobufSchema[]>(() =>
    readProtobufSchemas(window.localStorage)
  )
  const [selectedSchemaId, setSelectedSchemaId] = useState(() => schemas[0]?.id ?? '')
  const [schemaError, setSchemaError] = useState<string>()
  const selectedSchema = schemas.find((schema) => schema.id === selectedSchemaId) ?? schemas[0]
  const parsed = useMemo(() => {
    if (!selectedSchema) return undefined
    try {
      return parseProtobufSchema(selectedSchema.files)
    } catch (reason) {
      return reason instanceof Error ? reason : new Error(String(reason))
    }
  }, [selectedSchema])
  const messageTypes = parsed && !(parsed instanceof Error) ? parsed.messageTypes : []
  const selectedType = selectedSchema && messageTypes.includes(selectedSchema.selectedType)
    ? selectedSchema.selectedType
    : messageTypes[0]
  const inspection = useMemo(() => {
    if (!selectedType || !parsed || parsed instanceof Error) return undefined
    return inspectProtobufPayload(payloadBase64, parsed.root.lookupType(selectedType))
  }, [parsed, payloadBase64, selectedType])

  const persist = (next: StoredProtobufSchema[]): boolean => {
    try {
      writeProtobufSchemas(window.localStorage, next)
      setSchemas(next)
      setSchemaError(undefined)
      return true
    } catch (reason) {
      setSchemaError(reason instanceof Error ? reason.message : String(reason))
      return false
    }
  }

  const importSchemas = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget
    const files = [...(input.files ?? [])]
    input.value = ''
    if (files.length === 0) return
    if (files.length > MAX_PROTOBUF_SCHEMA_FILES) {
      setSchemaError(t('payload.protobufFileLimit', { count: MAX_PROTOBUF_SCHEMA_FILES }))
      return
    }
    if (schemas.length >= MAX_STORED_PROTOBUF_SCHEMAS) {
      setSchemaError(t('payload.protobufSchemaLimit', { count: MAX_STORED_PROTOBUF_SCHEMAS }))
      return
    }

    try {
      const sources: ProtobufSchemaFile[] = await Promise.all(files.map(async (file) => ({
        name: file.name,
        source: await file.text()
      })))
      const validated = parseProtobufSchema(sources)
      const id = schemaIdentifier()
      const schema: StoredProtobufSchema = {
        id,
        name: schemaName(files),
        files: sources,
        selectedType: validated.messageTypes[0],
        savedAt: new Date().toISOString()
      }
      if (persist([schema, ...schemas])) setSelectedSchemaId(id)
    } catch (reason) {
      setSchemaError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const selectMessageType = (nextType: string): void => {
    if (!selectedSchema) return
    persist(schemas.map((schema) => schema.id === selectedSchema.id
      ? { ...schema, selectedType: nextType }
      : schema))
  }

  const removeSchema = (): void => {
    if (!selectedSchema) return
    const next = schemas.filter((schema) => schema.id !== selectedSchema.id)
    if (persist(next)) setSelectedSchemaId(next[0]?.id ?? '')
  }

  return (
    <div className="structured-payload protobuf-inspector" role="tabpanel">
      <div className="structured-payload-head">
        <div>
          <span className="eyebrow">{t('payload.decoder')}</span>
          <h3>Protocol Buffers</h3>
          <p>{t('payload.protobufHelp')}</p>
        </div>
        <div className="structured-payload-tags">
          {explicit && <span className="tag accent">{t('payload.decoderContentType')}</span>}
          <span className="tag">.proto</span>
        </div>
      </div>

      <div className="protobuf-schema-controls">
        {schemas.length > 0 && (
          <>
            <label className="field">
              <span>{t('payload.protobufSchema')}</span>
              <select
                value={selectedSchema?.id ?? ''}
                onChange={(event) => setSelectedSchemaId(event.target.value)}
              >
                {schemas.map((schema) => (
                  <option key={schema.id} value={schema.id}>{schema.name}</option>
                ))}
              </select>
            </label>
            <label className="field protobuf-message-type">
              <span>{t('payload.protobufMessageType')}</span>
              <select
                value={selectedType ?? ''}
                disabled={messageTypes.length === 0}
                onChange={(event) => selectMessageType(event.target.value)}
              >
                {messageTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <button
              className="btn danger sm icon protobuf-delete"
              type="button"
              title={t('payload.protobufDeleteSchema')}
              aria-label={t('payload.protobufDeleteSchema')}
              onClick={removeSchema}
            >
              <TrashIcon width={14} height={14} />
            </button>
          </>
        )}
        <label className="btn ghost sm protobuf-import">
          {t(schemas.length > 0 ? 'payload.protobufImportAnother' : 'payload.protobufImport')}
          <input
            type="file"
            accept=".proto,text/plain"
            multiple
            onChange={(event) => { void importSchemas(event) }}
          />
        </label>
      </div>

      <p className="note protobuf-privacy">{t('payload.protobufPrivacy')}</p>
      {schemaError && <div className="structured-payload-error" role="alert"><code>{schemaError}</code></div>}
      {parsed instanceof Error && (
        <div className="structured-payload-error" role="alert"><code>{parsed.message}</code></div>
      )}
      {!selectedSchema && !schemaError && (
        <div className="protobuf-empty">
          <strong>{t('payload.protobufSchemaRequired')}</strong>
          <p>{t('payload.protobufSchemaRequiredHelp')}</p>
        </div>
      )}
      {inspection?.status === 'decoded' && inspection.tree && <PayloadTree tree={inspection.tree} />}
      {inspection && inspection.status !== 'decoded' && (
        <div className="structured-payload-error" role="alert">
          <strong>{t(inspection.status === 'too-large'
            ? 'payload.decoderTooLarge'
            : 'payload.decoderInvalid', { format: 'Protobuf' })}</strong>
          {inspection.error && <code>{inspection.error}</code>}
        </div>
      )}
      {inspection?.status === 'decoded' && (
        <small className="protobuf-decoded-count">
          {t('payload.protobufDecoded', { count: formatNumber(inspection.byteLength) })}
        </small>
      )}
    </div>
  )
}
