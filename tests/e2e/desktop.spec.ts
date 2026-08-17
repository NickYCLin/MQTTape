import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { _electron as electron, expect, test } from '@playwright/test'

const require = createRequire(import.meta.url)
const electronPath = require('electron') as string

test('desktop shell starts with the restricted preload bridge', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'mqttape-e2e-'))
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined

  try {
    application = await electron.launch({
      executablePath: electronPath,
      args: ['.', `--user-data-dir=${userDataDirectory}`],
      cwd: process.cwd(),
      env: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
      }
    })
    const window = await application.firstWindow()
    await expect(window).toHaveTitle('MQTTape')
    await expect(window.getByText('Desktop Full', { exact: true })).toBeVisible()
    await expect(window.getByLabel('Protocol')).toHaveValue('mqtt')
    await expect(window.getByLabel('Port')).toHaveValue('1883')
    await expect(window.getByRole('note')).toContainText(
      'MQTT over TCP · registered port 1883 · unencrypted'
    )

    const bridgeMethods = await window.evaluate(() => Object.keys(window.mqttape ?? {}).sort())
    expect(bridgeMethods).toEqual(expect.arrayContaining([
      'connect',
      'getUpdateStatus',
      'onMessage',
      'saveCapture',
      'saveDownlinkHistory'
    ]))

    const updateStatus = await window.evaluate(() => window.mqttape!.getUpdateStatus())
    expect(updateStatus).toMatchObject({ mode: 'disabled', reason: 'development' })

    await window.getByLabel('Interface language').selectOption('zh-TW')
    await expect(window.getByTitle('桌面完整版')).toBeVisible()
    await expect(window.getByRole('note')).toContainText('登記連接埠 1883')
  } finally {
    try {
      await application?.close()
    } finally {
      await rm(userDataDirectory, { recursive: true, force: true })
    }
  }
})
