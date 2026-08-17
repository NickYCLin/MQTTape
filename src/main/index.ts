import { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CaptureFile,
  ConnectionConfig,
  PublishRequest,
  SaveBrokerProfileRequest,
  SubscribeRequest,
  TlsFileKind
} from '../shared/contracts'
import { MqttService } from './mqtt-service'
import { ProfileStore } from './profile-store'
import { UpdateService } from './update-service'
import { resolveUpdateSupport } from './update-support'

let mainWindow: BrowserWindow | null = null
let updateService: UpdateService | null = null

const mqttService = new MqttService(
  (status) => mainWindow?.webContents.send('mqttape:status', status),
  (message) => mainWindow?.webContents.send('mqttape:message', message)
)
const selectedTlsFiles = new Set<string>()

async function assertTrustedTlsPaths(
  config: ConnectionConfig,
  profileStore: ProfileStore
): Promise<void> {
  const paths = [config.caPath, config.clientCertificatePath, config.clientKeyPath]
  for (const path of paths) {
    if (!path || selectedTlsFiles.has(path) || await profileStore.isTrustedTlsPath(path)) continue
    throw new Error('Select TLS files through MQTTape before connecting or saving a profile.')
  }
}

function registerIpcHandlers(profileStore: ProfileStore, updater: UpdateService): void {
  ipcMain.handle('mqttape:connect', async (_event, config: ConnectionConfig) => {
    await assertTrustedTlsPaths(config, profileStore)
    return mqttService.connect(config)
  })
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
  ipcMain.handle('mqttape:list-profiles', () => profileStore.list())
  ipcMain.handle(
    'mqttape:save-profile',
    async (_event, request: SaveBrokerProfileRequest) => {
      await assertTrustedTlsPaths(request.config, profileStore)
      return profileStore.save(request)
    }
  )
  ipcMain.handle('mqttape:delete-profile', (_event, id: string) => profileStore.delete(id))
  ipcMain.handle('mqttape:select-tls-file', async (_event, kind: TlsFileKind) => {
    const filters: Record<TlsFileKind, Electron.FileFilter[]> = {
      ca: [{ name: 'Certificate authority', extensions: ['pem', 'crt', 'cer'] }],
      certificate: [{ name: 'Client certificate', extensions: ['pem', 'crt', 'cer'] }],
      key: [{ name: 'Client private key', extensions: ['key', 'pem'] }]
    }
    if (!filters[kind]) throw new Error('Unsupported TLS file type.')
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select TLS file',
      properties: ['openFile'],
      filters: filters[kind]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const [path] = result.filePaths
    selectedTlsFiles.add(path)
    return path
  })
  ipcMain.handle('mqttape:get-update-status', () => updater.getStatus())
  ipcMain.handle('mqttape:check-for-updates', () => updater.checkForUpdates())
  ipcMain.handle('mqttape:install-update', () => updater.installUpdate())
}

function readLinuxPackageType(): string | undefined {
  if (process.platform !== 'linux') return undefined
  const packageTypePath = join(process.resourcesPath, 'package-type')
  if (!existsSync(packageTypePath)) return undefined
  try {
    return readFileSync(packageTypePath, 'utf8').trim()
  } catch {
    return undefined
  }
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
    const profileStore = new ProfileStore(join(app.getPath('userData'), 'profiles.json'), {
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      encrypt: (value) => safeStorage.encryptString(value),
      decrypt: (value) => safeStorage.decryptString(value)
    })
    updateService = new UpdateService(
      app.getVersion(),
      resolveUpdateSupport({
        isPackaged: app.isPackaged,
        platform: process.platform,
        portableExecutableDirectory: process.env.PORTABLE_EXECUTABLE_DIR,
        appImagePath: process.env.APPIMAGE,
        linuxPackageType: readLinuxPackageType()
      }),
      (status) => mainWindow?.webContents.send('mqttape:update-status', status)
    )
    registerIpcHandlers(profileStore, updateService)
    createWindow()
    updateService.start()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  void mqttService.disconnect()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => updateService?.dispose())
