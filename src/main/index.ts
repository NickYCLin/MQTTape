import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CaptureFile,
  ConnectionConfig,
  PublishRequest,
  SubscribeRequest
} from '../shared/contracts'
import { MqttService } from './mqtt-service'

let mainWindow: BrowserWindow | null = null

const mqttService = new MqttService(
  (status) => mainWindow?.webContents.send('mqttape:status', status),
  (message) => mainWindow?.webContents.send('mqttape:message', message)
)

function registerIpcHandlers(): void {
  ipcMain.handle('mqttape:connect', (_event, config: ConnectionConfig) =>
    mqttService.connect(config)
  )
  ipcMain.handle('mqttape:disconnect', () => mqttService.disconnect())
  ipcMain.handle('mqttape:subscribe', (_event, request: SubscribeRequest) =>
    mqttService.subscribe(request)
  )
  ipcMain.handle('mqttape:unsubscribe', (_event, topic: string) =>
    mqttService.unsubscribe(topic)
  )
  ipcMain.handle('mqttape:publish', (_event, request: PublishRequest) =>
    mqttService.publish(request)
  )
  ipcMain.handle('mqttape:save-capture', async (_event, capture: CaptureFile) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export MQTTape capture',
      defaultPath: join(
        app.getPath('documents'),
        `mqttape-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      ),
      filters: [{ name: 'MQTTape capture', extensions: ['json'] }]
    })

    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, JSON.stringify(capture, null, 2), 'utf8')
    return true
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#0b0f14',
    title: 'MQTTape',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    session.defaultSession.setPermissionCheckHandler(() => false)
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false)
    })
    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  void mqttService.disconnect()
  if (process.platform !== 'darwin') app.quit()
})
