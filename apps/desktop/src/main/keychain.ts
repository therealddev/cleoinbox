import { app, safeStorage } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

// Secrets at rest (OAuth tokens, LLM key): encrypted via the OS keychain
// (macOS Keychain / Windows DPAPI / Linux libsecret) through Electron
// safeStorage, persisted as an opaque blob under userData. No plaintext on
// disk, no DB. Main-process only. Wired here; consumed from step 4 (Gmail auth).

type Store = Record<string, string> // name -> base64 ciphertext

const secretsFile = (): string => join(app.getPath('userData'), 'secrets.json')

function load(): Store {
  const file = secretsFile()
  if (!existsSync(file)) return {}
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Store
  } catch {
    return {}
  }
}

function save(store: Store): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(secretsFile(), JSON.stringify(store), { mode: 0o600 })
}

export function setSecret(name: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain encryption is unavailable')
  }
  const store = load()
  store[name] = safeStorage.encryptString(value).toString('base64')
  save(store)
}

export function getSecret(name: string): string | null {
  const blob = load()[name]
  return blob ? safeStorage.decryptString(Buffer.from(blob, 'base64')) : null
}

export function deleteSecret(name: string): void {
  const store = load()
  delete store[name]
  save(store)
}
