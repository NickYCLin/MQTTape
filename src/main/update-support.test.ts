import { describe, expect, it } from 'vitest'
import { resolveUpdateSupport } from './update-support'

describe('resolveUpdateSupport', () => {
  it('disables update checks for development builds', () => {
    expect(resolveUpdateSupport({ isPackaged: false, platform: 'win32' })).toEqual({
      mode: 'disabled',
      reason: 'development'
    })
  })

  it('enables automatic updates for an installed Windows build', () => {
    expect(resolveUpdateSupport({ isPackaged: true, platform: 'win32' })).toEqual({
      mode: 'automatic'
    })
  })

  it('keeps the Windows portable build on manual downloads', () => {
    expect(resolveUpdateSupport({
      isPackaged: true,
      platform: 'win32',
      portableExecutableDirectory: 'C:\\Tools\\MQTTape'
    })).toEqual({ mode: 'manual', reason: 'portable' })
  })

  it('enables automatic updates for AppImage and Debian packages', () => {
    expect(resolveUpdateSupport({
      isPackaged: true,
      platform: 'linux',
      appImagePath: '/opt/MQTTape.AppImage'
    })).toEqual({ mode: 'automatic' })
    expect(resolveUpdateSupport({
      isPackaged: true,
      platform: 'linux',
      linuxPackageType: 'deb'
    })).toEqual({ mode: 'automatic' })
  })

  it('keeps unsigned macOS and unsupported packages on manual downloads', () => {
    expect(resolveUpdateSupport({ isPackaged: true, platform: 'darwin' })).toEqual({
      mode: 'manual',
      reason: 'unsigned-macos'
    })
    expect(resolveUpdateSupport({ isPackaged: true, platform: 'freebsd' })).toEqual({
      mode: 'manual',
      reason: 'unsupported-package'
    })
  })
})
