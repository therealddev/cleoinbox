import { contextBridge, ipcRenderer } from 'electron'
import type { CleoApi } from '@cleoinbox/shared'

// Minimal, purpose-built bridge. Every method is a typed invoke mirroring the
// CleoApi contract; the renderer never sees ipcRenderer, fs, tokens, or other
// Node primitives. Typing `api` as CleoApi makes drift from the contract a
// compile error.
const api: CleoApi = {
  getStatus: () => ipcRenderer.invoke('settings:getStatus'),
  setGoogleClient: (clientId, clientSecret) =>
    ipcRenderer.invoke('settings:setGoogleClient', clientId, clientSecret),
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  connectAccount: () => ipcRenderer.invoke('accounts:connect'),
  removeAccount: (email) => ipcRenderer.invoke('accounts:remove', email),
  listInbox: (email) => ipcRenderer.invoke('gmail:listInbox', email)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
