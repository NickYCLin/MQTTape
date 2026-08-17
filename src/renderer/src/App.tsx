import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ConnectionPanel } from './components/ConnectionPanel'
import {
  DownloadIcon,
  DownlinkIcon,
  GithubIcon,
  PlayIcon,
  SearchIcon,
  TapeIcon,
  TimelineIcon,
  TopicTreeIcon,
  TrashIcon,
  XIcon
} from './components/icons'
import { CaptureExportDialog } from './components/CaptureExportDialog'
import { MessageTimeline } from './components/MessageTimeline'
import { LoRaWanDownlinkTracker } from './components/LoRaWanDownlinkTracker'
import { PublishComposer } from './components/PublishComposer'
import { ReplayDialog } from './components/ReplayDialog'
import { SubscriptionPanel } from './components/SubscriptionPanel'
import { ThemeMenu } from './components/ThemeMenu'
import { TopicExplorer } from './components/TopicExplorer'
import { UpdateControl } from './components/UpdateControl'
import { useMqttSession } from './hooks/use-mqtt-session'
import { filterMessages, formatBytes } from '../../shared/message'
import type { CaptureFile, ConnectionState } from '../../shared/contracts'
import { isCaptureFile } from '../../shared/capture'
import { useI18n } from './i18n'
import type { TranslationKey } from './lib/i18n'
import type { LoRaWanDownlinkHistoryFile } from '../../shared/lorawan-downlink-history'

const statusLabelKeys: Record<ConnectionState, TranslationKey> = {
  disconnected: 'status.disconnected',
  connecting: 'status.connecting',
  connected: 'status.connected',
  reconnecting: 'status.reconnecting',
  offline: 'status.offline',
  error: 'status.error'
}

type SessionView = 'timeline' | 'topics' | 'downlinks'

const sessionTitleKeys: Record<SessionView, TranslationKey> = {
  timeline: 'session.timeline',
  topics: 'session.topicTree',
  downlinks: 'session.downlinks'
}

const sessionFilterPlaceholderKeys: Record<SessionView, TranslationKey> = {
  timeline: 'session.filterMessagesPlaceholder',
  topics: 'session.filterTopicsPlaceholder',
  downlinks: 'session.filterDownlinksPlaceholder'
}

const sessionFilterLabelKeys: Record<SessionView, TranslationKey> = {
  timeline: 'session.filterMessages',
  topics: 'session.filterTopics',
  downlinks: 'session.filterDownlinks'
}

export default function App() {
  const { language, setLanguage, t, translateMessage, formatNumber } = useI18n()
  const session = useMqttSession()
  const [query, setQuery] = useState('')
  const [activeView, setActiveView] = useState<SessionView>('timeline')
  const [captureToExport, setCaptureToExport] = useState<CaptureFile | null>(null)
  const [replayCapture, setReplayCapture] = useState<CaptureFile | null>(null)
  const captureInputRef = useRef<HTMLInputElement>(null)
  const connected = session.status.state === 'connected'
  const connecting = session.status.state === 'connecting' || session.status.state === 'reconnecting'
  const visibleMessages = useMemo(
    () => filterMessages(session.messages, query),
    [query, session.messages]
  )
  const endpoint = `${session.config.host}:${session.config.port}`
  const statusDetail = session.status.detail
    || (connected ? endpoint : t(session.isDesktop ? 'mode.desktopFull' : 'mode.webSocketLite'))

  const saveCapture = async (capture: CaptureFile): Promise<boolean> => {
    try {
      if (window.mqttape) return window.mqttape.saveCapture(capture)

      const blob = new Blob([JSON.stringify(capture, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `mqttape-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      return true
    } catch (reason) {
      session.reportError(reason instanceof Error ? reason.message : String(reason))
      return false
    }
  }

  const saveDownlinkHistory = async (
    history: LoRaWanDownlinkHistoryFile
  ): Promise<boolean> => {
    try {
      if (window.mqttape) return window.mqttape.saveDownlinkHistory(history)

      const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `mqttape-downlinks-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      return true
    } catch (reason) {
      session.reportError(reason instanceof Error ? reason.message : String(reason))
      return false
    }
  }

  const importAndReplay = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isCaptureFile(parsed)) {
        session.reportError('The selected file is not a supported MQTTape v1 capture.')
        return
      }
      session.resetReplay()
      setReplayCapture(parsed)
    } catch (reason) {
      session.reportError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><TapeIcon width={20} height={20} /></span>
          <span className="brand-text">
            <strong>MQTTape</strong>
            <small>{t('app.tagline')}</small>
          </span>
        </div>

        <div className={`status status-${session.status.state}`}>
          <span className="status-dot" aria-hidden="true" />
          <span className="status-text">
            <strong>{t(statusLabelKeys[session.status.state])}</strong>
            <small title={statusDetail}>{statusDetail}</small>
          </span>
        </div>

        <div className="topbar-actions">
          <UpdateControl />
          <ThemeMenu />
          <label className="select-inline">
            <span className="sr-only">{t('language.label')}</span>
            <select
              aria-label={t('language.label')}
              value={language}
              onChange={(event) => setLanguage(event.target.value as 'en' | 'zh-TW')}
            >
              <option value="en">{t('language.english')}</option>
              <option value="zh-TW">{t('language.traditionalChinese')}</option>
            </select>
          </label>
          <a
            className="btn ghost icon"
            href="https://github.com/NickYCLin/MQTTape"
            target="_blank"
            rel="noreferrer"
            title={t('app.github')}
            aria-label={t('app.github')}
          >
            <GithubIcon width={16} height={16} />
          </a>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <ConnectionPanel
            config={session.config}
            connected={connected}
            connecting={connecting}
            busy={session.busy}
            isDesktop={session.isDesktop}
            profiles={session.profiles}
            selectedProfileId={session.selectedProfileId}
            onChange={session.setConfig}
            onConnect={session.connect}
            onDisconnect={session.disconnect}
            onSelectProfile={session.selectProfile}
            onSaveProfile={() => void session.saveProfile()}
            onDeleteProfile={() => void session.deleteProfile()}
            onSelectTlsFile={session.selectTlsFile}
          />
          <SubscriptionPanel
            connected={connected && !session.busy}
            subscriptions={session.subscriptions}
            onSubscribe={session.subscribe}
            onUnsubscribe={session.unsubscribe}
          />
        </aside>

        <main className="stage">
          <section className="metrics" aria-label={t('stats.label')}>
            <div className="metric">
              <span className="metric-label">{t('common.incoming')}</span>
              <strong className="metric-value">{formatNumber(session.stats.incoming)}</strong>
              <small className="metric-note">{t('stats.messages')}</small>
            </div>
            <div className="metric">
              <span className="metric-label">{t('common.outgoing')}</span>
              <strong className="metric-value">{formatNumber(session.stats.outgoing)}</strong>
              <small className="metric-note">{t('stats.messages')}</small>
            </div>
            <div className="metric">
              <span className="metric-label">{t('stats.captured')}</span>
              <strong className="metric-value">{formatBytes(session.stats.bytes)}</strong>
              <small className="metric-note">{t('stats.inSession')}</small>
            </div>
            <div className="metric">
              <span className="metric-label">{t('stats.recorder')}</span>
              <strong className="metric-value metric-state">
                <i className={`rec-dot ${connected ? 'recording' : ''}`} aria-hidden="true" />
                {t(connected ? 'stats.live' : 'stats.ready')}
              </strong>
              <small className="metric-note">{t('stats.limit')}</small>
            </div>
          </section>

          <section className="stage-panel" aria-labelledby="stage-title">
            <h2 className="sr-only" id="stage-title">
              {t(sessionTitleKeys[activeView])}
            </h2>
            <div className="stage-toolbar">
              <div className="segmented" role="group" aria-label={t('session.view')}>
                <button
                  className={activeView === 'timeline' ? 'active' : ''}
                  type="button"
                  aria-pressed={activeView === 'timeline'}
                  onClick={() => setActiveView('timeline')}
                >
                  <TimelineIcon width={15} height={15} />
                  <span>{t('session.timelineTab')}</span>
                </button>
                <button
                  className={activeView === 'topics' ? 'active' : ''}
                  type="button"
                  aria-pressed={activeView === 'topics'}
                  onClick={() => setActiveView('topics')}
                >
                  <TopicTreeIcon width={15} height={15} />
                  <span>{t('session.topicsTab')}</span>
                </button>
                <button
                  className={activeView === 'downlinks' ? 'active' : ''}
                  type="button"
                  aria-pressed={activeView === 'downlinks'}
                  onClick={() => setActiveView('downlinks')}
                >
                  <DownlinkIcon width={15} height={15} />
                  <span>{t('session.downlinksTab')}</span>
                </button>
              </div>

              <label className="search">
                <SearchIcon width={15} height={15} />
                <input
                  value={query}
                  placeholder={t(sessionFilterPlaceholderKeys[activeView])}
                  aria-label={t(sessionFilterLabelKeys[activeView])}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button type="button" aria-label={t('session.clearFilter')} onClick={() => setQuery('')}>
                    <XIcon width={14} height={14} />
                  </button>
                )}
              </label>

              <div className="toolbar-actions">
                <button
                  className="btn ghost icon"
                  type="button"
                  title={t('session.clearMessages')}
                  aria-label={t('session.clearMessages')}
                  disabled={session.messages.length === 0}
                  onClick={session.clearMessages}
                >
                  <TrashIcon width={16} height={16} />
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={!connected || session.busy}
                  onClick={() => captureInputRef.current?.click()}
                >
                  <PlayIcon width={16} height={16} />
                  <span>{t('session.replay')}</span>
                </button>
                <input
                  ref={captureInputRef}
                  className="sr-only"
                  type="file"
                  accept="application/json,.json"
                  aria-label={t('session.captureFile')}
                  tabIndex={-1}
                  onChange={importAndReplay}
                />
                <button
                  className="btn ghost"
                  type="button"
                  disabled={session.messages.length === 0 || session.busy}
                  onClick={() => setCaptureToExport(session.makeCapture())}
                >
                  <DownloadIcon width={16} height={16} />
                  <span>{t('session.export')}</span>
                </button>
              </div>
            </div>

            {query && activeView === 'timeline' && (
              <p className="filter-note">
                {t('session.filterResult', {
                  visible: formatNumber(visibleMessages.length),
                  total: formatNumber(session.messages.length)
                })}
              </p>
            )}

            <div className={`stage-scroll ${activeView !== 'timeline' ? 'no-scroll' : ''}`}>
              {activeView === 'timeline' ? (
                <MessageTimeline messages={visibleMessages} />
              ) : activeView === 'topics' ? (
                <TopicExplorer
                  messages={session.messages}
                  query={query}
                  onInspectTopic={(topic) => {
                    setQuery(topic)
                    setActiveView('timeline')
                  }}
                />
              ) : (
                <LoRaWanDownlinkTracker
                  messages={session.messages}
                  query={query}
                  onExport={saveDownlinkHistory}
                />
              )}
            </div>
          </section>

          <PublishComposer connected={connected && !session.busy} onPublish={session.publish} />
        </main>
      </div>

      {session.error && (
        <div className="toast" role="alert">
          <div className="toast-copy">
            <strong>{t('error.operationFailed')}</strong>
            <span>{translateMessage(session.error)}</span>
          </div>
          <button type="button" aria-label={t('error.dismiss')} onClick={session.clearError}>
            <XIcon width={16} height={16} />
          </button>
        </div>
      )}

      {captureToExport && (
        <CaptureExportDialog
          capture={captureToExport}
          onExport={saveCapture}
          onClose={() => setCaptureToExport(null)}
        />
      )}

      {replayCapture && (
        <ReplayDialog
          capture={replayCapture}
          progress={session.replayProgress}
          onStart={(options) => void session.startReplay(replayCapture, options)}
          onPause={session.pauseReplay}
          onResume={session.resumeReplay}
          onCancel={session.cancelReplay}
          onClose={() => {
            session.resetReplay()
            setReplayCapture(null)
          }}
        />
      )}
    </div>
  )
}
