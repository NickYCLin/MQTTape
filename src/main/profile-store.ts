import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type {
  BrokerProfile,
  ConnectionConfig,
  SaveBrokerProfileRequest
} from '../shared/contracts'

interface SecretProtector {
  isAvailable(): boolean
  encrypt(value: string): Buffer
  decrypt(value: Buffer): string
}

interface StoredProfile {
  id: string
  config: Omit<ConnectionConfig, 'password' | 'clientKeyPassphrase'>
  encryptedSecrets?: string
}

interface StoredProfileFile {
  version: 1
  profiles: StoredProfile[]
}

interface ProfileSecrets {
  password: string
  clientKeyPassphrase: string
}

function withoutSecrets(
  config: ConnectionConfig
): Omit<ConnectionConfig, 'password' | 'clientKeyPassphrase'> {
  const safeConfig: Partial<ConnectionConfig> = { ...config }
  delete safeConfig.password
  delete safeConfig.clientKeyPassphrase
  return safeConfig as Omit<ConnectionConfig, 'password' | 'clientKeyPassphrase'>
}

function normalizeStoredProfile(value: unknown): StoredProfile | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<StoredProfile>
  if (typeof candidate.id !== 'string' || !candidate.id || !candidate.config) return null
  if (typeof candidate.config !== 'object' || typeof candidate.config.name !== 'string') return null

  return {
    id: candidate.id,
    config: {
      ...candidate.config,
      caPath: candidate.config.caPath ?? '',
      clientCertificatePath: candidate.config.clientCertificatePath ?? '',
      clientKeyPath: candidate.config.clientKeyPath ?? ''
    },
    encryptedSecrets: typeof candidate.encryptedSecrets === 'string'
      ? candidate.encryptedSecrets
      : undefined
  } as StoredProfile
}

export class ProfileStore {
  constructor(
    private readonly filePath: string,
    private readonly protector: SecretProtector
  ) {}

  async list(): Promise<BrokerProfile[]> {
    const profiles = await this.readStoredProfiles()
    return profiles.map((profile) => this.toBrokerProfile(profile))
  }

  async save(request: SaveBrokerProfileRequest): Promise<BrokerProfile> {
    const profileName = request.config.name.trim()
    if (!profileName) throw new Error('Profile name is required.')

    const profiles = await this.readStoredProfiles()
    const id = request.id || randomUUID()
    const existingIndex = profiles.findIndex((profile) => profile.id === id)
    const secrets: ProfileSecrets = {
      password: request.config.password,
      clientKeyPassphrase: request.config.clientKeyPassphrase
    }
    const hasNewSecrets = Boolean(secrets.password || secrets.clientKeyPassphrase)
    let encryptedSecrets: string | undefined

    if (hasNewSecrets && this.protector.isAvailable()) {
      encryptedSecrets = this.protector.encrypt(JSON.stringify(secrets)).toString('base64')
    }

    const stored: StoredProfile = {
      id,
      config: withoutSecrets({ ...request.config, name: profileName }),
      encryptedSecrets
    }

    if (existingIndex >= 0) profiles[existingIndex] = stored
    else profiles.push(stored)
    if (profiles.length > 100) throw new Error('A maximum of 100 broker profiles is supported.')

    await this.writeStoredProfiles(profiles)
    return this.toBrokerProfile(stored)
  }

  async delete(id: string): Promise<void> {
    const profiles = await this.readStoredProfiles()
    const next = profiles.filter((profile) => profile.id !== id)
    if (next.length !== profiles.length) await this.writeStoredProfiles(next)
  }

  async isTrustedTlsPath(path: string): Promise<boolean> {
    if (!path) return true
    const profiles = await this.readStoredProfiles()
    return profiles.some(({ config }) =>
      config.caPath === path ||
      config.clientCertificatePath === path ||
      config.clientKeyPath === path
    )
  }

  private async readStoredProfiles(): Promise<StoredProfile[]> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!parsed || typeof parsed !== 'object') return []
      const file = parsed as Partial<StoredProfileFile>
      if (file.version !== 1 || !Array.isArray(file.profiles)) return []
      return file.profiles
        .map(normalizeStoredProfile)
        .filter((profile): profile is StoredProfile => profile !== null)
    } catch (reason) {
      if ((reason as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw new Error('Broker profiles could not be read.', { cause: reason })
    }
  }

  private async writeStoredProfiles(profiles: StoredProfile[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const file: StoredProfileFile = { version: 1, profiles }
    await writeFile(this.filePath, JSON.stringify(file, null, 2), { encoding: 'utf8', mode: 0o600 })
  }

  private toBrokerProfile(profile: StoredProfile): BrokerProfile {
    const secrets = this.decryptSecrets(profile.encryptedSecrets)
    return {
      id: profile.id,
      config: {
        ...profile.config,
        password: secrets.password,
        clientKeyPassphrase: secrets.clientKeyPassphrase
      },
      secretsStored: Boolean(profile.encryptedSecrets && this.protector.isAvailable())
    }
  }

  private decryptSecrets(value: string | undefined): ProfileSecrets {
    if (!value || !this.protector.isAvailable()) {
      return { password: '', clientKeyPassphrase: '' }
    }

    try {
      const parsed: unknown = JSON.parse(this.protector.decrypt(Buffer.from(value, 'base64')))
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid secret payload.')
      const secrets = parsed as Partial<ProfileSecrets>
      return {
        password: typeof secrets.password === 'string' ? secrets.password : '',
        clientKeyPassphrase: typeof secrets.clientKeyPassphrase === 'string'
          ? secrets.clientKeyPassphrase
          : ''
      }
    } catch {
      return { password: '', clientKeyPassphrase: '' }
    }
  }
}
