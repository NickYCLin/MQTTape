import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BrokerProfile,
  CaptureFile,
  ConnectionConfig,
  MqttMessageRecord,
  MqttQos,
  ReplayOptions,
  ReplayProgress,
  StatusEvent,
  TlsFileKind
} from '../../../shared/contracts'
import { publishTopicError } from '../../../shared/mqtt-topic'
import { createReplayPlan, replayDelay, replayTimingScale } from '../../../shared/replay'
import { MqttController } from '../lib/mqtt-controller'

const MAX_MESSAGES = 5_000
const WEB_PROFILE_KEY = 'mqttape:profiles:v1'

interface ReplayControl {
  cancelled: boolean
  paused: boolean
  wake?: () => void
}

const idleReplay: ReplayProgress = { state: 'idle', sent: 0, total: 0 }

class ReplayCancelledError extends Error {}

async function waitUntilReplayResumes(control: ReplayControl): Promise<void> {
  if (!control.paused) return
  await new Promise<void>((resolve) => {
    control.wake = resolve
  })
  control.wake = undefined
}

async function waitForReplayDelay(milliseconds: number, control: ReplayControl): Promise<void> {
  let remaining = milliseconds
  while (remaining > 0) {
    if (control.cancelled) throw new ReplayCancelledError()
    await waitUntilReplayResumes(control)
    if (control.cancelled) throw new ReplayCancelledError()

    const slice = Math.min(remaining, 100)
    await new Promise((resolve) => window.setTimeout(resolve, slice))
    if (!control.paused) remaining -= slice
  }
}

function captureConnection(config: ConnectionConfig): CaptureFile['connection'] {
  const safeConfig: Partial<ConnectionConfig> = { ...config }
  delete safeConfig.password
  delete safeConfig.caPath
  delete safeConfig.clientCertificatePath
  delete safeConfig.clientKeyPath
  delete safeConfig.clientKeyPassphrase
  return safeConfig as CaptureFile['connection']
}

function webSafeConfig(config: ConnectionConfig): ConnectionConfig {
  return {
    ...config,
    password: '',
    rejectUnauthorized: true,
    caPath: '',
    clientCertificatePath: '',
    clientKeyPath: '',
    clientKeyPassphrase: ''
  }
}

function readWebProfiles(): BrokerProfile[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(WEB_PROFILE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((profile): profile is BrokerProfile =>
      Boolean(
        profile &&
        typeof profile === 'object' &&
        typeof profile.id === 'string' &&
        profile.config &&
        typeof profile.config.name === 'string'
      )
    ).map((profile) => ({ ...profile, config: webSafeConfig(profile.config), secretsStored: false }))
  } catch {
    return []
  }
}

function defaultConfig(isDesktop: boolean): ConnectionConfig {
  return {
    name: '',
    protocol: isDesktop ? 'mqtt' : 'wss',
    host: '',
    port: isDesktop ? 1883 : 8084,
    path: 'mqtt',
    clientId: `mqttape_${Math.random().toString(16).slice(2, 10)}`,
    username: '',
    password: '',
    mqttVersion: 5,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 1_000,
    rejectUnauthorized: true,
    caPath: '',
    clientCertificatePath: '',
    clientKeyPath: '',
    clientKeyPassphrase: ''
  }
}

export function useMqttSession() {
  const [controller] = useState(() => new MqttController())

  const [config, setConfig] = useState<ConnectionConfig>(() => defaultConfig(controller.isDesktop))
  const [status, setStatus] = useState<StatusEvent>({ state: 'disconnected' })
  const [messages, setMessages] = useState<MqttMessageRecord[]>([])
  const [subscriptions, setSubscriptions] = useState<Map<string, MqttQos>>(new Map())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [profiles, setProfiles] = useState<BrokerProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [replayProgress, setReplayProgress] = useState<ReplayProgress>(idleReplay)
  const replayControlRef = useRef<ReplayControl | null>(null)

  useEffect(() => {
    controller.activate()
    const removeStatus = controller.onStatus(setStatus)
    const removeMessage = controller.onMessage((message) => {
      setMessages((current) => {
        const next = [message, ...current]
        return next.length > MAX_MESSAGES ? next.slice(0, MAX_MESSAGES) : next
      })
    })

    return () => {
      if (replayControlRef.current) {
        replayControlRef.current.cancelled = true
        replayControlRef.current.wake?.()
      }
      removeStatus()
      removeMessage()
      controller.destroy()
    }
  }, [controller])

  useEffect(() => {
    let mounted = true
    const loadProfiles = async (): Promise<void> => {
      try {
        const loaded = window.mqttape
          ? await window.mqttape.listProfiles()
          : readWebProfiles()
        if (mounted) setProfiles(loaded)
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : String(reason))
      }
    }
    void loadProfiles()
    return () => { mounted = false }
  }, [])

  const run = useCallback(async (operation: () => Promise<void>): Promise<boolean> => {
    setBusy(true)
    setError('')
    try {
      await operation()
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const selectProfile = useCallback((id: string) => {
    setSelectedProfileId(id)
    if (!id) {
      setConfig(defaultConfig(controller.isDesktop))
      return
    }
    const profile = profiles.find((candidate) => candidate.id === id)
    if (profile) setConfig({ ...profile.config })
  }, [controller.isDesktop, profiles])

  const saveProfile = useCallback(async () => {
    if (!config.name.trim()) {
      setError('Profile name is required.')
      return false
    }

    let savedProfile: BrokerProfile | undefined
    const succeeded = await run(async () => {
      if (window.mqttape) {
        savedProfile = await window.mqttape.saveProfile({
          id: selectedProfileId || undefined,
          config
        })
        return
      }

      savedProfile = {
        id: selectedProfileId || window.crypto.randomUUID(),
        config: webSafeConfig({ ...config, name: config.name.trim() }),
        secretsStored: false
      }
      const next = profiles.filter((profile) => profile.id !== savedProfile!.id)
      next.push(savedProfile)
      window.localStorage.setItem(WEB_PROFILE_KEY, JSON.stringify(next))
    })

    if (!succeeded || !savedProfile) return false
    setProfiles((current) => {
      const next = current.filter((profile) => profile.id !== savedProfile!.id)
      next.push(savedProfile!)
      return next.sort((left, right) => left.config.name.localeCompare(right.config.name))
    })
    setSelectedProfileId(savedProfile.id)
    if (window.mqttape && (config.password || config.clientKeyPassphrase) && !savedProfile.secretsStored) {
      setError('Profile saved, but secure OS storage is unavailable; secrets were not stored.')
    }
    return true
  }, [config, profiles, run, selectedProfileId])

  const deleteProfile = useCallback(async () => {
    if (!selectedProfileId) return false
    const succeeded = await run(async () => {
      if (window.mqttape) await window.mqttape.deleteProfile(selectedProfileId)
      else {
        const next = profiles.filter((profile) => profile.id !== selectedProfileId)
        window.localStorage.setItem(WEB_PROFILE_KEY, JSON.stringify(next))
      }
    })
    if (succeeded) {
      setProfiles((current) => current.filter((profile) => profile.id !== selectedProfileId))
      setSelectedProfileId('')
      setConfig(defaultConfig(controller.isDesktop))
    }
    return succeeded
  }, [controller.isDesktop, profiles, run, selectedProfileId])

  const selectTlsFile = useCallback(async (kind: TlsFileKind): Promise<string | null> => {
    if (!window.mqttape) return null
    try {
      return await window.mqttape.selectTlsFile(kind)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return null
    }
  }, [])

  const connect = useCallback(async () => {
    await run(() => controller.connect(config))
  }, [config, controller, run])

  const disconnect = useCallback(async () => {
    if (await run(() => controller.disconnect())) setSubscriptions(new Map())
  }, [controller, run])

  const subscribe = useCallback(
    async (topic: string, qos: MqttQos) => {
      const normalized = topic.trim()
      if (!normalized) {
        setError('Subscription topic is required.')
        return false
      }
      const succeeded = await run(() => controller.subscribe({ topic: normalized, qos }))
      if (succeeded) {
        setSubscriptions((current) => new Map(current).set(normalized, qos))
      }
      return succeeded
    },
    [controller, run]
  )

  const unsubscribe = useCallback(
    async (topic: string) => {
      const succeeded = await run(() => controller.unsubscribe(topic))
      if (succeeded) {
        setSubscriptions((current) => {
          const next = new Map(current)
          next.delete(topic)
          return next
        })
      }
    },
    [controller, run]
  )

  const publish = useCallback(
    async (topic: string, payload: string, qos: MqttQos, retain: boolean) => {
      const normalizedTopic = topic.trim()
      const topicError = publishTopicError(normalizedTopic)
      if (topicError) {
        setError(topicError)
        return false
      }
      return run(() => controller.publish({ topic: normalizedTopic, payload, qos, retain }))
    },
    [controller, run]
  )

  const startReplay = useCallback(
    async (capture: CaptureFile, options: ReplayOptions) => {
      if (status.state !== 'connected') {
        setError('Connect to a broker before replaying a capture.')
        return false
      }
      if (replayControlRef.current) {
        setError('A replay is already running.')
        return false
      }

      const replayPlan = createReplayPlan(capture.messages, options)
      if (replayPlan.length === 0) {
        setError('Select at least one message direction that exists in this capture.')
        return false
      }
      const invalidPlanItem = replayPlan
        .map((item) => ({ item, error: publishTopicError(item.topic) }))
        .find(({ error: topicError }) => topicError)
      if (invalidPlanItem) {
        setError(`Invalid replay topic "${invalidPlanItem.item.topic}": ${invalidPlanItem.error}`)
        return false
      }

      const control: ReplayControl = { cancelled: false, paused: false }
      replayControlRef.current = control
      setBusy(true)
      setError('')
      setReplayProgress({ state: 'running', sent: 0, total: replayPlan.length })

      try {
        const messagesToReplay = replayPlan.map(({ message }) => message)
        const timingScale = replayTimingScale(messagesToReplay)
        let previousTimestamp = replayPlan[0].message.timestamp

        for (const [index, planItem] of replayPlan.entries()) {
          const { message, topic } = planItem
          if (control.cancelled) throw new ReplayCancelledError()
          if (index > 0) {
            await waitForReplayDelay(
              replayDelay(previousTimestamp, message.timestamp, timingScale, options.speed),
              control
            )
          }

          await waitUntilReplayResumes(control)
          if (control.cancelled) throw new ReplayCancelledError()
          setReplayProgress((current) => ({
            ...current,
            state: 'running',
            currentTopic: topic
          }))
          await controller.publish({
            topic,
            payload: message.payloadText,
            payloadBase64: message.payloadBase64,
            qos: message.qos,
            retain: message.retain
          })
          previousTimestamp = message.timestamp
          setReplayProgress({
            state: 'running',
            sent: index + 1,
            total: replayPlan.length,
            currentTopic: topic
          })
        }

        setReplayProgress({
          state: 'completed',
          sent: replayPlan.length,
          total: replayPlan.length
        })
        return true
      } catch (reason) {
        if (reason instanceof ReplayCancelledError) {
          setReplayProgress((current) => ({ ...current, state: 'cancelled' }))
          return false
        }
        setError(reason instanceof Error ? reason.message : String(reason))
        setReplayProgress((current) => ({ ...current, state: 'cancelled' }))
        return false
      } finally {
        if (replayControlRef.current === control) replayControlRef.current = null
        setBusy(false)
      }
    },
    [controller, status.state]
  )

  const pauseReplay = useCallback(() => {
    const control = replayControlRef.current
    if (!control || control.paused) return
    control.paused = true
    setReplayProgress((current) => ({ ...current, state: 'paused' }))
  }, [])

  const resumeReplay = useCallback(() => {
    const control = replayControlRef.current
    if (!control || !control.paused) return
    control.paused = false
    control.wake?.()
    setReplayProgress((current) => ({ ...current, state: 'running' }))
  }, [])

  const cancelReplay = useCallback(() => {
    const control = replayControlRef.current
    if (!control) return
    control.cancelled = true
    control.paused = false
    control.wake?.()
  }, [])

  const resetReplay = useCallback(() => {
    if (!replayControlRef.current) setReplayProgress(idleReplay)
  }, [])

  const stats = useMemo(() => {
    let incoming = 0
    let outgoing = 0
    let bytes = 0
    for (const message of messages) {
      if (message.direction === 'incoming') incoming += 1
      else outgoing += 1
      bytes += message.size
    }
    return { incoming, outgoing, bytes }
  }, [messages])

  const makeCapture = useCallback((): CaptureFile => {
    return {
      format: 'mqttape-capture',
      version: 1,
      exportedAt: new Date().toISOString(),
      connection: captureConnection(config),
      messages: [...messages].reverse()
    }
  }, [config, messages])

  return {
    isDesktop: controller.isDesktop,
    config,
    setConfig,
    profiles,
    selectedProfileId,
    selectProfile,
    saveProfile,
    deleteProfile,
    selectTlsFile,
    status,
    messages,
    subscriptions,
    stats,
    error,
    clearError: () => setError(''),
    reportError: setError,
    busy,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    publish,
    replayProgress,
    startReplay,
    pauseReplay,
    resumeReplay,
    cancelReplay,
    resetReplay,
    clearMessages: () => setMessages([]),
    makeCapture
  }
}
