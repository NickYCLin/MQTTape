import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ConnectionPanel } from './components/ConnectionPanel'
import {
  DownloadIcon,
  SearchIcon,
  TapeIcon,
  TrashIcon,
  UploadIcon,
  XIcon
} from './components/icons'
import { MessageTimeline } from './components/MessageTimeline'
import { PublishComposer } from './components/PublishComposer'
import { ReplayDialog } from './components/ReplayDialog'
import { SubscriptionPanel } from './components/SubscriptionPanel'
import { useMqttSession } from './hooks/use-mqtt-session'
import { filterMessages, formatBytes } from '../../shared/message'
import type { CaptureFile, ConnectionState } from '../../shared/contracts'
import { isCaptureFile } from '../../shared/capture'

const statusLabels: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
  error: 'Connection error'
}

export default function App() {
  const session = useMqttSession()
  const [query, setQuery] = useState('')
  const [replayCapture, setReplayCapture] = useState<CaptureFile | null>(null)
  const captureInputRef = useRef<HTMLInputElement>(null)
  const connected = session.status.state === 'connected'
  const connecting = session.status.state === 'connecting' || session.status.state === 'reconnecting'
  const visibleMessages = useMemo(
    () => filterMessages(session.messages, query),
    [query, session.messages]
  )

  const exportCapture = async (): Promise<void> => {
    const capture = session.makeCapture()
    if (window.mqttape) {
      await window.mqttape.saveCapture(capture)
      return
    }

    const blob = new Blob([JSON.stringify(capture, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `mqttape-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    anchor.click()
    URL.revokeObjectURL(url)
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
            <p>Capture · Inspect · Replay</p>
          </div>
        </div>
        <div className="header-status">
          <span className={`status-dot ${session.status.state}`} />
          <div>
            <strong>{statusLabels[session.status.state]}</strong>
            <span>{session.status.detail || (session.isDesktop ? 'Desktop Full' : 'WebSocket Lite')}</span>
          </div>
        </div>
        <a
          className="github-link"
          href="https://github.com/NickYCLin/MQTTape"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
          <span aria-hidden="true">↗</span>
        </a>
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
          <section className="stats-row" aria-label="Session statistics">
            <div className="stat-card">
              <span>Incoming</span>
              <strong>{session.stats.incoming.toLocaleString()}</strong>
              <small>messages</small>
            </div>
            <div className="stat-card">
              <span>Outgoing</span>
              <strong>{session.stats.outgoing.toLocaleString()}</strong>
              <small>messages</small>
            </div>
            <div className="stat-card">
              <span>Captured</span>
              <strong>{formatBytes(session.stats.bytes)}</strong>
              <small>in this session</small>
            </div>
            <div className="stat-card capture-state">
              <span>Recorder</span>
              <strong><i className={connected ? 'recording' : ''} />{connected ? 'Live' : 'Ready'}</strong>
              <small>up to 5,000 messages</small>
            </div>
          </section>

          <section className="timeline-panel">
            <div className="timeline-toolbar">
              <div>
                <span className="eyebrow">LIVE SESSION</span>
                <h2>Message timeline</h2>
              </div>
              <div className="toolbar-actions">
                <label className="search-box">
                  <SearchIcon />
                  <input
                    value={query}
                    placeholder="Filter topic or payload"
                    aria-label="Filter messages"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button type="button" aria-label="Clear filter" onClick={() => setQuery('')}>
                      <XIcon width={14} height={14} />
                    </button>
                  )}
                </label>
                <button
                  className="icon-button"
                  type="button"
                  title="Clear messages"
                  aria-label="Clear messages"
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
                  Replay
                </button>
                <input
                  ref={captureInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="application/json,.json"
                  tabIndex={-1}
                  onChange={importAndReplay}
                />
                <button
                  className="secondary-button"
                  type="button"
                  disabled={session.messages.length === 0 || session.busy}
                  onClick={exportCapture}
                >
                  <DownloadIcon />
                  Export
                </button>
              </div>
            </div>

            {query && (
              <div className="filter-result">
                Showing {visibleMessages.length} of {session.messages.length} messages
              </div>
            )}
            <div className="timeline-scroll">
              <MessageTimeline messages={visibleMessages} />
            </div>
          </section>

          <PublishComposer connected={connected && !session.busy} onPublish={session.publish} />
        </main>
      </div>

      {session.error && (
        <div className="error-toast" role="alert">
          <div>
            <strong>MQTT operation failed</strong>
            <span>{session.error}</span>
          </div>
          <button type="button" aria-label="Dismiss error" onClick={session.clearError}>
            <XIcon />
          </button>
        </div>
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
