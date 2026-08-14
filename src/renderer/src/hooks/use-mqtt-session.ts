import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CaptureFile,
  ConnectionConfig,
  MqttMessageRecord,
  MqttQos,
  StatusEvent
} from '../../../shared/contracts'
import { MqttController } from '../lib/mqtt-controller'

const MAX_MESSAGES = 5_000

function withoutPassword(config: ConnectionConfig): Omit<ConnectionConfig, 'password'> {
  const safeConfig: Partial<ConnectionConfig> = { ...config }
  delete safeConfig.password
  return safeConfig as Omit<ConnectionConfig, 'password'>
}

function defaultConfig(isDesktop: boolean): ConnectionConfig {
  return {
    name: 'Local broker',
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
    rejectUnauthorized: true
  }
}

export function useMqttSession() {
  const controllerRef = useRef<MqttController | null>(null)
  if (!controllerRef.current) controllerRef.current = new MqttController()
  const controller = controllerRef.current

  const [config, setConfig] = useState<ConnectionConfig>(() => defaultConfig(controller.isDesktop))
  const [status, setStatus] = useState<StatusEvent>({ state: 'disconnected' })
  const [messages, setMessages] = useState<MqttMessageRecord[]>([])
  const [subscriptions, setSubscriptions] = useState<Map<string, MqttQos>>(new Map())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
      removeStatus()
      removeMessage()
      controller.destroy()
    }
  }, [controller])

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
      if (!topic.trim()) {
        setError('Publish topic is required.')
        return false
      }
      return run(() => controller.publish({ topic: topic.trim(), payload, qos, retain }))
    },
    [controller, run]
  )

  const replayCapture = useCallback(
    async (capture: CaptureFile) => {
      if (status.state !== 'connected') {
        setError('Connect to a broker before replaying a capture.')
        return false
      }
      if (capture.messages.length === 0) {
        setError('This capture contains no messages.')
        return false
      }

      return run(async () => {
        const messagesToReplay = capture.messages.slice(0, MAX_MESSAGES)
        const firstTime = new Date(messagesToReplay[0].timestamp).getTime()
        const lastTime = new Date(messagesToReplay.at(-1)!.timestamp).getTime()
        const captureDuration = Number.isFinite(lastTime - firstTime)
          ? Math.max(0, lastTime - firstTime)
          : 0
        const timingScale = captureDuration > 30_000 ? 30_000 / captureDuration : 1
        let previousTime = new Date(messagesToReplay[0].timestamp).getTime()

        for (const message of messagesToReplay) {
          const messageTime = new Date(message.timestamp).getTime()
          const rawDelay = Number.isFinite(messageTime - previousTime)
            ? Math.max(0, messageTime - previousTime)
            : 0
          const safeDelay = Math.min(rawDelay * timingScale, 2_000)
          if (safeDelay > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, safeDelay))
          }
          await controller.publish({
            topic: message.topic,
            payload: message.payloadText,
            payloadBase64: message.payloadBase64,
            qos: message.qos,
            retain: message.retain
          })
          previousTime = messageTime
        }
      })
    },
    [controller, run, status.state]
  )

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
      connection: withoutPassword(config),
      messages: [...messages].reverse()
    }
  }, [config, messages])

  return {
    isDesktop: controller.isDesktop,
    config,
    setConfig,
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
    replayCapture,
    clearMessages: () => setMessages([]),
    makeCapture
  }
}
