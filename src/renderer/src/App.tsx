import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ConnectionPanel } from './components/ConnectionPanel'
import {
  DownloadIcon,
  SearchIcon,
  TapeIcon,
  TimelineIcon,
  TopicTreeIcon,
  TrashIcon,
  UploadIcon,
  XIcon
} from './components/icons'
import { CaptureExportDialog } from './components/CaptureExportDialog'
import { MessageTimeline } from './components/MessageTimeline'
import { PublishComposer } from './components/PublishComposer'
import { ReplayDialog } from './components/ReplayDialog'
import { SubscriptionPanel } from './components/SubscriptionPanel'
import { TopicExplorer } from './components/TopicExplorer'
import { UpdateControl } from './components/UpdateControl'
import { useMqttSession } from './hooks/use-mqtt-session'
import { filterMessages, formatBytes } from '../../shared/message'
import type { CaptureFile, ConnectionState } from '../../shared/contracts'
import { isCaptureFile } from '../../shared/capture'
import { useI18n } from './i18n'
import type { TranslationKey } from './lib/i18n'

const statusLabelKeys: Record<ConnectionState, TranslationKey> = {
  disconnected: 'status.disconnected',
  connecting: 'status.connecting',
  connected: 'status.connected',
  reconnecting: 'status.reconnecting',
  offline: 'status.offline',
  error: 'status.error'
}

export default function App() {
  const { language, setLanguage, t, translateMessage, formatNumber } = useI18n()
  const session = useMqttSession()
  const [query, setQuery] = useState('')
  const [activeView, setActiveView] = useState<'timeline' | 'topics'>('timeline')
  const [captureToExport, setCaptureToExport] = useState<CaptureFile | null>(null)
  const [replayCapture, setReplayCapture] = useState<CaptureFile | null>(null)
  const captureInputRef = useRef<HTMLInputElement>(null)
  const connected = session.status.state === 'connected'
  const connecting = session.status.state === 'connecting' || session.status.state === 'reconnecting'
  const visibleMessages = useMemo(
    () => filterMessages(session.messages, query),
    [query, session.messages]
  )

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
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark"><TapeIcon width={25} height={25} /></div>
          <div>
            <h1>MQTTape</h1>
            <p>{t('app.tagline')}</p>
          </div>
        </div>
        <div className="header-status">
          <span className={`status-dot ${session.status.state}`} />
          <div>
            <strong>{t(statusLabelKeys[session.status.state])}</strong>
            <span>{session.status.detail || t(session.isDesktop ? 'mode.desktopFull' : 'mode.webSocketLite')}</span>
          </div>
        </div>
        <div className="header-actions">
          <UpdateControl />
          <label className="language-switcher">
            <span>{t('language.label')}</span>
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
            className="github-link"
            href="https://github.com/NickYCLin/MQTTape"
            target="_blank"
            rel="noreferrer"
          >
            {t('app.github')}
            <span aria-hidden="true">↗</span>
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

        <main className="main-stage">
          <section className="stats-row" aria-label={t('stats.label')}>
            <div className="stat-card">
              <span>{t('common.incoming')}</span>
              <strong>{formatNumber(session.stats.incoming)}</strong>
              <small>{t('stats.messages')}</small>
            </div>
            <div className="stat-card">
              <span>{t('common.outgoing')}</span>
              <strong>{formatNumber(session.stats.outgoing)}</strong>
              <small>{t('stats.messages')}</small>
            </div>
            <div className="stat-card">
              <span>{t('stats.captured')}</span>
              <strong>{formatBytes(session.stats.bytes)}</strong>
              <small>{t('stats.inSession')}</small>
            </div>
            <div className="stat-card capture-state">
              <span>{t('stats.recorder')}</span>
              <strong><i className={connected ? 'recording' : ''} />{t(connected ? 'stats.live' : 'stats.ready')}</strong>
              <small>{t('stats.limit')}</small>
            </div>
          </section>

          <section className="timeline-panel">
            <div className="timeline-toolbar">
              <div>
                <span className="eyebrow">{t(activeView === 'timeline' ? 'session.live' : 'session.topicExplorer')}</span>
                <h2>{t(activeView === 'timeline' ? 'session.timeline' : 'session.topicTree')}</h2>
              </div>
              <div className="toolbar-actions">
                <div className="view-switcher" aria-label={t('session.view')}>
                  <button
                    className={activeView === 'timeline' ? 'active' : ''}
                    type="button"
                    aria-pressed={activeView === 'timeline'}
                    onClick={() => setActiveView('timeline')}
                  >
                    <TimelineIcon />
                    {t('session.timelineTab')}
                  </button>
                  <button
                    className={activeView === 'topics' ? 'active' : ''}
                    type="button"
                    aria-pressed={activeView === 'topics'}
                    onClick={() => setActiveView('topics')}
                  >
                    <TopicTreeIcon />
                    {t('session.topicsTab')}
                  </button>
                </div>
                <label className="search-box">
                  <SearchIcon />
                  <input
                    value={query}
                    placeholder={t(activeView === 'timeline' ? 'session.filterMessagesPlaceholder' : 'session.filterTopicsPlaceholder')}
                    aria-label={t(activeView === 'timeline' ? 'session.filterMessages' : 'session.filterTopics')}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button type="button" aria-label={t('session.clearFilter')} onClick={() => setQuery('')}>
                      <XIcon width={14} height={14} />
                    </button>
                  )}
                </label>
                <button
                  className="icon-button"
                  type="button"
                  title={t('session.clearMessages')}
                  aria-label={t('session.clearMessages')}
                  disabled={session.messages.length === 0}
                  onClick={session.clearMessages}
                >
                  <TrashIcon />
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!connected || session.busy}
                  onClick={() => captureInputRef.current?.click()}
                >
                  <UploadIcon />
                  {t('session.replay')}
                </button>
                <input
                  ref={captureInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="application/json,.json"
                  aria-label={t('session.captureFile')}
                  tabIndex={-1}
                  onChange={importAndReplay}
                />
                <button
                  className="secondary-button"
                  type="button"
                  disabled={session.messages.length === 0 || session.busy}
                  onClick={() => setCaptureToExport(session.makeCapture())}
                >
                  <DownloadIcon />
                  {t('session.export')}
                </button>
              </div>
            </div>

            {query && activeView === 'timeline' && (
              <div className="filter-result">
                {t('session.filterResult', {
                  visible: formatNumber(visibleMessages.length),
                  total: formatNumber(session.messages.length)
                })}
              </div>
            )}
            <div className={`timeline-scroll ${activeView === 'topics' ? 'topic-scroll' : ''}`}>
              {activeView === 'timeline' ? (
                <MessageTimeline messages={visibleMessages} />
              ) : (
                <TopicExplorer
                  messages={session.messages}
                  query={query}
                  onInspectTopic={(topic) => {
                    setQuery(topic)
                    setActiveView('timeline')
                  }}
                />
              )}
            </div>
          </section>

          <PublishComposer connected={connected && !session.busy} onPublish={session.publish} />
        </main>
      </div>

      {session.error && (
        <div className="error-toast" role="alert">
          <div>
            <strong>{t('error.operationFailed')}</strong>
            <span>{translateMessage(session.error)}</span>
          </div>
          <button type="button" aria-label={t('error.dismiss')} onClick={session.clearError}>
            <XIcon />
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
