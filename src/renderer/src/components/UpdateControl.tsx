import { useEffect, useState } from 'react'
import type { AppUpdateStatus } from '../../../shared/contracts'
import { useI18n } from '../i18n'
import { DownloadIcon } from './icons'

const RELEASES_URL = 'https://github.com/NickYCLin/MQTTape/releases/latest'

export function UpdateControl() {
  const { t } = useI18n()
  const [status, setStatus] = useState<AppUpdateStatus | null>(null)

  useEffect(() => {
    const bridge = window.mqttape
    if (!bridge) return undefined

    let active = true
    const removeListener = bridge.onUpdateStatus((nextStatus) => {
      if (active) setStatus(nextStatus)
    })
    void bridge.getUpdateStatus().then((nextStatus) => {
      if (active) setStatus(nextStatus)
    })

    return () => {
      active = false
      removeListener()
    }
  }, [])

  if (!status || status.mode === 'disabled') return null

  if (status.mode === 'manual') {
    return (
      <a
        className="update-control manual"
        href={RELEASES_URL}
        target="_blank"
        rel="noreferrer"
        title={t(status.reason === 'portable' ? 'update.manualPortable' : 'update.manual')}
      >
        <DownloadIcon />
        <span>{t(status.reason === 'portable' ? 'update.manualPortable' : 'update.manual')}</span>
      </a>
    )
  }

  const progress = status.progress ?? 0
  const label = (() => {
    switch (status.state) {
      case 'checking': return t('update.checking')
      case 'available': return t('update.available', { version: status.targetVersion ?? '' })
      case 'downloading': return t('update.downloading', { progress })
      case 'downloaded': return t('update.downloaded')
      case 'up-to-date': return t('update.upToDate')
      case 'error': return t('update.error')
      default: return t('update.check')
    }
  })()
  const busy = ['checking', 'available', 'downloading'].includes(status.state)

  const handleClick = async (): Promise<void> => {
    const bridge = window.mqttape
    if (!bridge) return
    if (status.state === 'downloaded') {
      await bridge.installUpdate()
      return
    }
    await bridge.checkForUpdates()
  }

  return (
    <button
      className={`update-control ${status.state}`}
      type="button"
      disabled={busy}
      aria-live="polite"
      aria-label={label}
      title={label}
      onClick={() => void handleClick()}
    >
      <DownloadIcon />
      <span>{label}</span>
    </button>
  )
}
