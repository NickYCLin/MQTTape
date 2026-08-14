import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ConnectionConfig } from '../shared/contracts'
import { ProfileStore } from './profile-store'

const temporaryDirectories: string[] = []

function config(): ConnectionConfig {
  return {
    name: 'Production broker',
    protocol: 'mqtts',
    host: 'broker.example.com',
    port: 8883,
    path: 'mqtt',
    clientId: 'mqttape_test',
    username: 'device',
    password: 'broker-secret',
    mqttVersion: 5,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 1_000,
    rejectUnauthorized: true,
    caPath: 'C:/certs/ca.pem',
    clientCertificatePath: 'C:/certs/client.pem',
    clientKeyPath: 'C:/certs/client.key',
    clientKeyPassphrase: 'key-secret'
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ))
})

describe('ProfileStore', () => {
  it('encrypts secrets and restores the profile', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mqttape-profile-'))
    temporaryDirectories.push(directory)
    const filePath = join(directory, 'profiles.json')
    const protector = {
      isAvailable: () => true,
      encrypt: (value: string) => Buffer.from(value.split('').reverse().join('')),
      decrypt: (value: Buffer) => value.toString().split('').reverse().join('')
    }
    const store = new ProfileStore(filePath, protector)

    const saved = await store.save({ config: config() })
    const rawFile = await readFile(filePath, 'utf8')
    const [loaded] = await store.list()

    expect(saved.secretsStored).toBe(true)
    expect(rawFile).not.toContain('broker-secret')
    expect(rawFile).not.toContain('key-secret')
    expect(loaded.config.password).toBe('broker-secret')
    expect(loaded.config.clientKeyPassphrase).toBe('key-secret')
    expect(await store.isTrustedTlsPath('C:/certs/client.key')).toBe(true)
  })

  it('never falls back to plaintext when secure storage is unavailable', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mqttape-profile-'))
    temporaryDirectories.push(directory)
    const filePath = join(directory, 'profiles.json')
    const store = new ProfileStore(filePath, {
      isAvailable: () => false,
      encrypt: () => Buffer.alloc(0),
      decrypt: () => ''
    })

    const saved = await store.save({ config: config() })
    const rawFile = await readFile(filePath, 'utf8')

    expect(saved.secretsStored).toBe(false)
    expect(rawFile).not.toContain('broker-secret')
    expect(rawFile).not.toContain('key-secret')
  })

  it('removes previously encrypted secrets when they are cleared', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mqttape-profile-'))
    temporaryDirectories.push(directory)
    const filePath = join(directory, 'profiles.json')
    const protector = {
      isAvailable: () => true,
      encrypt: (value: string) => Buffer.from(value.split('').reverse().join('')),
      decrypt: (value: Buffer) => value.toString().split('').reverse().join('')
    }
    const store = new ProfileStore(filePath, protector)

    const saved = await store.save({ config: config() })
    const cleared = await store.save({
      id: saved.id,
      config: { ...saved.config, password: '', clientKeyPassphrase: '' }
    })
    const rawFile = await readFile(filePath, 'utf8')

    expect(cleared.secretsStored).toBe(false)
    expect(cleared.config.password).toBe('')
    expect(cleared.config.clientKeyPassphrase).toBe('')
    expect(rawFile).not.toContain('encryptedSecrets')
  })
})
