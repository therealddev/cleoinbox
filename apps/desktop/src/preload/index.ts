import { contextBridge } from 'electron'

// Minimal, purpose-built bridge. Expose only typed, channel-specific methods
// as IPC is added — never expose ipcRenderer, fs, or Node primitives directly.
const api = {}

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
