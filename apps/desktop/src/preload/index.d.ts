import type { CleoApi } from '@cleoinbox/shared'

declare global {
  interface Window {
    api: CleoApi
  }
}

export {}
