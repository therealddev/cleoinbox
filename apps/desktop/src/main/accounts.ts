import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
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
  writeFileSync(accountsFile(), JSON.stringify(accounts, null, 2))
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
