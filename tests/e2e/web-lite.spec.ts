import { readFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from '@playwright/test'
import { generate, parser } from 'mqtt-packet'
import { createWebSocketStream, WebSocketServer } from 'ws'
import {
  DOWNLINK_HISTORY_STORAGE_KEY,
  type LoRaWanDownlinkHistoryFile
} from '../../src/shared/lorawan-downlink-history'

const downlinkHistory = {
  format: 'mqttape-downlink-history',
  version: 1,
  exportedAt: '2026-08-17T06:20:00.000Z',
  events: [
    {
      id: 'e2e-request',
      messageId: 'e2e-request',
      provider: 'the-things-stack',
      kind: 'request',
      status: 'requested',
      direction: 'outgoing',
      observedAt: '2026-08-17T06:18:00.000Z',
      occurredAt: '2026-08-17T06:18:00.000Z',
      topic: 'v3/demo/devices/sensor-01/down/push',
      applicationId: 'demo',
      deviceId: 'sensor-01',
      devEui: '4200000000000001',
      correlationIds: ['mqttape:e2e-history'],
      fPort: 10,
      confirmed: true
    },
    {
      id: 'e2e-ack',
      messageId: 'e2e-ack',
      provider: 'the-things-stack',
      kind: 'ack',
      status: 'acknowledged',
      direction: 'incoming',
      observedAt: '2026-08-17T06:19:00.000Z',
      occurredAt: '2026-08-17T06:19:00.000Z',
      topic: 'v3/demo/devices/sensor-01/down/ack',
      applicationId: 'demo',
      deviceId: 'sensor-01',
      devEui: '4200000000000001',
      correlationIds: ['mqttape:e2e-history'],
      fPort: 10,
      frameCounter: 25,
      confirmed: true
    }
  ]
} satisfies LoRaWanDownlinkHistoryFile

test('Web Lite starts and persists the selected interface language', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('MQTTape')
  await expect(page.getByRole('heading', { name: 'Connection' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText(
    'MQTT over Secure WebSocket · 8084 is a common Broker default · encrypted'
  )
  await expect(page.getByRole('note')).toContainText(
    'Web Lite requires WS or WSS because browsers cannot open raw MQTT TCP sockets.'
  )

  await page.getByLabel('Protocol').selectOption('ws')
  await expect(page.getByLabel('Port')).toHaveValue('8083')
  await expect(page.getByRole('note')).toContainText(
    'MQTT over WebSocket · 8083 is a common Broker default · unencrypted'
  )

  const language = page.getByLabel('Interface language')
  await language.selectOption('zh-TW')
  await expect(page.getByRole('heading', { name: '連線' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText('8083 是部分 Broker 的常見預設')

  await page.reload()
  await expect(page.getByLabel('介面語言')).toHaveValue('zh-TW')
  await expect(page.getByRole('heading', { name: '連線' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText('此連接埠只是起始建議值')
})

test('Web Lite inspects MQTT 5 publish properties in both languages', async ({ page }) => {
  const packetOptions = { protocolVersion: 5 }
  const server = createServer()
  const websocketServer = new WebSocketServer({ server, path: '/mqtt' })
  websocketServer.on('connection', (socket) => {
    const stream = createWebSocketStream(socket)
    const packetParser = parser(packetOptions)
    stream.on('data', (data) => packetParser.parse(data))
    packetParser.on('packet', (packet) => {
      if (packet.cmd === 'connect') {
        stream.write(generate({
          cmd: 'connack',
          reasonCode: 0,
          sessionPresent: false,
          properties: {}
        }, packetOptions))
        return
      }
      if (packet.cmd === 'subscribe') {
        stream.write(generate({
          cmd: 'suback',
          messageId: packet.messageId,
          granted: packet.subscriptions.map(({ qos }) => qos),
          properties: {}
        }, packetOptions))
        stream.write(generate({
          cmd: 'publish',
          topic: 'demo/mqtt5',
          payload: Buffer.from('{"temperature":24.8}'),
          qos: 0,
          dup: false,
          retain: false,
          properties: {
            payloadFormatIndicator: true,
            messageExpiryInterval: 120,
            responseTopic: 'demo/replies',
            correlationData: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
            contentType: 'application/json',
            subscriptionIdentifier: [7, 12],
            userProperties: { source: ['gateway', 'e2e'] }
          }
        }, packetOptions))
      }
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = (server.address() as AddressInfo).port

  try {
    await page.goto('/')
    await page.getByLabel('Protocol').selectOption('ws')
    await page.getByLabel('Host').fill('127.0.0.1')
    await page.getByLabel('Port').fill(String(port))
    await page.getByRole('button', { name: 'Connect' }).click()
    await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible()

    await page.getByLabel('Subscription topic').fill('demo/mqtt5')
    await page.getByRole('button', { name: 'Add' }).click()
    const message = page.getByRole('button', { name: /demo\/mqtt5.*MQTT 5/ })
    await expect(message).toBeVisible()
    await message.click()

    await expect(page.getByRole('heading', { name: 'Publish properties' })).toBeVisible()
    await expect(page.getByText('application/json', { exact: true })).toBeVisible()
    await expect(page.getByText('3q2+7w==', { exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'gateway', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'e2e', exact: true })).toBeVisible()

    await page.getByLabel('Interface language').selectOption('zh-TW')
    await expect(page.getByRole('heading', { name: '發布屬性' })).toBeVisible()
    await expect(page.getByText('關聯資料（4 位元組）', { exact: true })).toBeVisible()
  } finally {
    websocketServer.clients.forEach((client) => client.terminate())
    await new Promise<void>((resolve) => websocketServer.close(() => resolve()))
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test('Downlink history survives reload, exports safely, and can be cleared', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(([key, history]) => {
    window.localStorage.setItem(key, history)
  }, [DOWNLINK_HISTORY_STORAGE_KEY, JSON.stringify(downlinkHistory)])
  await page.reload()

  await page.getByRole('button', { name: 'Downlinks' }).click()
  await expect(page.getByText('sensor-01', { exact: true })).toBeVisible()
  await expect(page.getByText('Acknowledged', { exact: true })).toBeVisible()
  await expect(page.getByText('2 saved event(s)', { exact: true })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Downlinks' }).click()
  await expect(page.getByText('sensor-01', { exact: true })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export history' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^mqttape-downlinks-.+\.json$/)
  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  const exportedText = await readFile(downloadPath!, 'utf8')
  const exported = JSON.parse(exportedText) as LoRaWanDownlinkHistoryFile
  expect(exported).toMatchObject({
    format: 'mqttape-downlink-history',
    version: 1
  })
  expect(exported.events).toHaveLength(2)
  expect(exportedText).not.toContain('payload')
  expect(exportedText).not.toContain('password')

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm')
    expect(dialog.message()).toContain('Clear all saved downlink history')
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Clear history' }).click()
  await expect(page.getByRole('heading', { name: 'No downlink events observed yet' }))
    .toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Downlinks' }).click()
  await expect(page.getByRole('heading', { name: 'No downlink events observed yet' }))
    .toBeVisible()
})
