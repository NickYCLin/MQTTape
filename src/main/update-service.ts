import electronUpdater, { type AppUpdater } from 'electron-updater'
import type { AppUpdateStatus } from '../shared/contracts'
import type { UpdateSupport } from './update-support'

const INITIAL_CHECK_DELAY_MS = 10_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000

function getAutoUpdater(): AppUpdater {
  const { autoUpdater } = electronUpdater
  return autoUpdater
}

export class UpdateService {
  private status: AppUpdateStatus
  private updater: AppUpdater | null = null
  private initialCheckTimer: ReturnType<typeof setTimeout> | null = null
  private intervalTimer: ReturnType<typeof setInterval> | null = null
  private checkInProgress = false

  constructor(
    currentVersion: string,
    support: UpdateSupport,
    private readonly onStatus: (status: AppUpdateStatus) => void,
    private readonly updaterFactory: () => AppUpdater = getAutoUpdater
  ) {
    this.status = {
      mode: support.mode,
      state: 'idle',
      currentVersion,
      reason: support.reason
    }
  }

  start(): void {
    if (this.status.mode !== 'automatic' || this.updater) return

    const updater = this.updaterFactory()
    this.updater = updater
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = true
    updater.autoRunAppAfterInstall = true
    updater.allowPrerelease = false
    updater.disableWebInstaller = true

    updater.on('checking-for-update', () => {
      this.setStatus({ state: 'checking', progress: undefined })
    })
    updater.on('update-available', (info) => {
      this.setStatus({ state: 'available', targetVersion: info.version, progress: 0 })
    })
    updater.on('download-progress', (progress) => {
      this.setStatus({
        state: 'downloading',
        progress: Math.min(100, Math.max(0, Math.round(progress.percent)))
      })
    })
    updater.on('update-downloaded', (info) => {
      this.setStatus({ state: 'downloaded', targetVersion: info.version, progress: 100 })
    })
    updater.on('update-not-available', () => {
      this.setStatus({ state: 'up-to-date', targetVersion: undefined, progress: undefined })
    })
    updater.on('error', (error) => {
      console.error('MQTTape update failed:', error.message)
      this.setStatus({ state: 'error', progress: undefined })
    })

    this.initialCheckTimer = setTimeout(() => void this.checkForUpdates(), INITIAL_CHECK_DELAY_MS)
    this.intervalTimer = setInterval(() => void this.checkForUpdates(), CHECK_INTERVAL_MS)
  }

  getStatus(): AppUpdateStatus {
    return { ...this.status }
  }

  async checkForUpdates(): Promise<AppUpdateStatus> {
    if (!this.updater || this.checkInProgress || this.status.state === 'downloaded') {
      return this.getStatus()
    }

    this.checkInProgress = true
    try {
      await this.updater.checkForUpdates()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      console.error('MQTTape update check failed:', message)
      this.setStatus({ state: 'error', progress: undefined })
    } finally {
      this.checkInProgress = false
    }
    return this.getStatus()
  }

  installUpdate(): boolean {
    if (!this.updater || this.status.state !== 'downloaded') return false
    this.updater.quitAndInstall(false, true)
    return true
  }

  dispose(): void {
    if (this.initialCheckTimer) clearTimeout(this.initialCheckTimer)
    if (this.intervalTimer) clearInterval(this.intervalTimer)
    this.initialCheckTimer = null
    this.intervalTimer = null
  }

  private setStatus(update: Partial<AppUpdateStatus>): void {
    this.status = { ...this.status, ...update }
    this.onStatus(this.getStatus())
  }
}
