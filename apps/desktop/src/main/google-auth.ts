import { shell } from 'electron'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library'
import { gmail } from '@googleapis/gmail'
import { getSecret, setSecret, deleteSecret } from './keychain'
import { addAccount, removeAccount } from './accounts'

// Google OAuth for a desktop app: PKCE + loopback redirect
// (http://127.0.0.1:<ephemeral-port>), per Google's current native-app
// guidance (OOB is deprecated). Everything here runs in the main process —
// tokens never reach the renderer. Restricted scopes (gmail.modify,
// gmail.settings.basic) keep v1 in Google "testing" mode (≤100 users, 7-day
// refresh tokens; CASA verification is a phase-2 gate).

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic'
]

const CLIENT_ID_KEY = 'google.client_id'
const CLIENT_SECRET_KEY = 'google.client_secret'
const refreshKey = (email: string): string => `google.refresh:${email}`

const AUTH_TIMEOUT_MS = 5 * 60 * 1000

export function hasGoogleClient(): boolean {
  return Boolean(getSecret(CLIENT_ID_KEY)) && Boolean(getSecret(CLIENT_SECRET_KEY))
}

export function setGoogleClient(clientId: string, clientSecret: string): void {
  setSecret(CLIENT_ID_KEY, clientId.trim())
  setSecret(CLIENT_SECRET_KEY, clientSecret.trim())
}

function clientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = getSecret(CLIENT_ID_KEY)
  const clientSecret = getSecret(CLIENT_SECRET_KEY)
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client is not configured. Add it in Settings.')
  }
  return { clientId, clientSecret }
}

/** Run the interactive consent flow for one account: open the system browser,
 *  catch the loopback redirect, exchange the code (+ PKCE verifier) for tokens,
 *  store the refresh token in the keychain keyed by the account email, and
 *  record the account. */
export async function connectAccount(): Promise<{ email: string }> {
  const { clientId, clientSecret } = clientCredentials()
  const { code, codeVerifier, client } = await runLoopbackFlow(clientId, clientSecret)

  const { tokens } = await client.getToken({ code, codeVerifier })
  client.setCredentials(tokens)

  const email = await fetchEmail(client)
  if (tokens.refresh_token) {
    setSecret(refreshKey(email), tokens.refresh_token)
  } else if (!getSecret(refreshKey(email))) {
    throw new Error(
      'Google did not return a refresh token. Remove Cleoinbox from your Google account permissions, then reconnect.'
    )
  }
  addAccount(email)
  return { email }
}

/** An OAuth2 client for an already-connected account, primed with its stored
 *  refresh token. googleapis refreshes the access token on demand; a rotated
 *  refresh token (if Google issues one) is persisted back to the keychain. */
export function getAuthClient(email: string): OAuth2Client {
  const { clientId, clientSecret } = clientCredentials()
  const refreshToken = getSecret(refreshKey(email))
  if (!refreshToken) {
    throw new Error(`${email} needs to reconnect.`)
  }
  const client = new OAuth2Client(clientId, clientSecret)
  client.setCredentials({ refresh_token: refreshToken })
  client.on('tokens', (next) => {
    if (next.refresh_token) setSecret(refreshKey(email), next.refresh_token)
  })
  return client
}

export function disconnectAccount(email: string): void {
  deleteSecret(refreshKey(email))
  removeAccount(email)
}

/** Start a one-shot localhost server on an ephemeral port, open the browser to
 *  Google's consent page, and resolve with the returned authorization code. */
function runLoopbackFlow(
  clientId: string,
  clientSecret: string
): Promise<{ code: string; codeVerifier: string; client: OAuth2Client }> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    let settled = false
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close()
      fn()
    }
    const timer = setTimeout(
      () => finish(() => reject(new Error('Authentication timed out.'))),
      AUTH_TIMEOUT_MS
    )

    server.on('error', (err) => finish(() => reject(err)))
    server.listen(0, '127.0.0.1', async () => {
      const { port } = server.address() as AddressInfo
      const redirectUri = `http://127.0.0.1:${port}`
      const client = new OAuth2Client(clientId, clientSecret, redirectUri)
      const codes = await client.generateCodeVerifierAsync()
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
        code_challenge_method: CodeChallengeMethod.S256,
        code_challenge: codes.codeChallenge
      })

      server.on('request', (req, res) => {
        const reqUrl = new URL(req.url ?? '/', redirectUri)
        if (reqUrl.pathname === '/favicon.ico') {
          res.writeHead(204)
          res.end()
          return
        }
        const error = reqUrl.searchParams.get('error')
        const code = reqUrl.searchParams.get('code')
        res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' })
        res.end(resultPage(!error))
        if (error) {
          finish(() => reject(new Error(`Google returned an error: ${error}`)))
        } else if (code) {
          finish(() => resolve({ code, codeVerifier: codes.codeVerifier, client }))
        }
      })

      try {
        await shell.openExternal(authUrl)
      } catch (err) {
        finish(() => reject(err as Error))
      }
    })
  })
}

/** Read the connected account's own address. getProfile works under any Gmail
 *  scope, so it avoids requesting a separate userinfo scope. */
async function fetchEmail(auth: OAuth2Client): Promise<string> {
  const client = gmail({ version: 'v1', auth })
  const { data } = await client.users.getProfile({ userId: 'me' })
  if (!data.emailAddress) throw new Error('Could not read the account email from Gmail.')
  return data.emailAddress
}

const resultPage = (ok: boolean): string =>
  `<!doctype html><meta charset="utf-8"><title>Cleoinbox</title>` +
  `<body style="font:16px system-ui;display:grid;place-items:center;height:90vh;margin:0">` +
  `<p>${ok ? 'Connected. You can close this tab and return to Cleoinbox.' : 'Authentication failed. Return to Cleoinbox and try again.'}</p>`
