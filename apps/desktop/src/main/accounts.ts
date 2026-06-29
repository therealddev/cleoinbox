import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import type { Account } from '@cleoinbox/shared'

// Non-secret per-account metadata (which inboxes are connected), persisted as
// accounts.json under userData. The PRD's "no DB" rule means no relational/
// server DB — a small app-config JSON is fine. OAuth tokens never live here;
// they're encrypted in the OS keychain, keyed by email (see keychain.ts).

const accountsFile = (): string => join(app.getPath('userData'), 'accounts.json')

export function listAccounts(): Account[] {
  const file = accountsFile()
  if (!existsSync(file)) return []
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Account[]
  } catch {
    return []
  }
}

function save(accounts: Account[]): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  // Write-then-rename so an interrupted or concurrent write can't leave a
  // truncated file (which would parse-fail and silently drop every account).
  const file = accountsFile()
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(accounts, null, 2))
  renameSync(tmp, file)
}

/** Add a connected account, or refresh its timestamp if already present. */
export function addAccount(email: string): void {
  const accounts = listAccounts().filter((a) => a.email !== email)
  accounts.push({ email, addedAt: new Date().toISOString() })
  save(accounts)
}

export function removeAccount(email: string): void {
  save(listAccounts().filter((a) => a.email !== email))
}
