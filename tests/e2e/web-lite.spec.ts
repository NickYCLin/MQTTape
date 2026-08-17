import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
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

  const language = page.getByLabel('Interface language')
  await language.selectOption('zh-TW')
  await expect(page.getByRole('heading', { name: '連線' })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('介面語言')).toHaveValue('zh-TW')
  await expect(page.getByRole('heading', { name: '連線' })).toBeVisible()
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
