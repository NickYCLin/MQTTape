import type { UpdateMode, UpdateSupportReason } from '../shared/contracts'

export interface UpdateEnvironment {
  isPackaged: boolean
  platform: NodeJS.Platform
  arch: NodeJS.Architecture
  portableExecutableDirectory?: string
  appImagePath?: string
  linuxPackageType?: string
}

export interface UpdateSupport {
  mode: UpdateMode
  reason?: UpdateSupportReason
}

export function resolveUpdateSupport(environment: UpdateEnvironment): UpdateSupport {
  if (!environment.isPackaged) return { mode: 'disabled', reason: 'development' }

  // Release metadata currently points at the x64 differential packages. ARM64
  // builds stay on explicit downloads until per-architecture feeds are split.
  if (environment.arch === 'arm64') {
    return { mode: 'manual', reason: 'unsupported-architecture' }
  }
  if (environment.arch !== 'x64') return { mode: 'manual', reason: 'unsupported-package' }

  if (environment.platform === 'win32') {
    return environment.portableExecutableDirectory
      ? { mode: 'manual', reason: 'portable' }
      : { mode: 'automatic' }
  }

  if (environment.platform === 'darwin') {
    return { mode: 'manual', reason: 'unsigned-macos' }
  }

  if (environment.platform === 'linux') {
    if (environment.appImagePath || environment.linuxPackageType === 'deb') {
      return { mode: 'automatic' }
    }
    return { mode: 'manual', reason: 'unsupported-package' }
  }

  return { mode: 'manual', reason: 'unsupported-package' }
}
