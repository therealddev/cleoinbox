import { ipcMain } from 'electron'
import { listAccounts } from './accounts'
import { connectAccount, disconnectAccount, hasGoogleClient, setGoogleClient } from './google-auth'
import { listInbox } from './gmail'

// The single typed IPC surface between renderer and main. Every channel is
// invoke/handle (request → response); no secrets ever cross to the renderer.
// Channels mirror the CleoApi contract in @cleoinbox/shared.
export function registerIpc(): void {
  ipcMain.handle('settings:getStatus', () => ({ hasGoogleClient: hasGoogleClient() }))
  ipcMain.handle('settings:setGoogleClient', (_e, clientId: string, clientSecret: string) =>
    setGoogleClient(clientId, clientSecret)
  )
  ipcMain.handle('accounts:list', () => listAccounts())
  ipcMain.handle('accounts:connect', () => connectAccount())
  ipcMain.handle('accounts:remove', (_e, email: string) => disconnectAccount(email))
  ipcMain.handle('gmail:listInbox', (_e, email: string) => listInbox(email))
}
