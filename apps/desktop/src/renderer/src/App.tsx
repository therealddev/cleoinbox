import { useEffect, useState } from 'react'
import type { Account, InboxMessage, SettingsStatus } from '@cleoinbox/shared'

const api = window.api

function App(): React.JSX.Element {
  const [status, setStatus] = useState<SettingsStatus | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [inbox, setInbox] = useState<InboxMessage[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')

  async function refresh(): Promise<void> {
    setStatus(await api.getStatus())
    setAccounts(await api.listAccounts())
  }

  useEffect(() => {
    void (async () => {
      try {
        const [s, a] = await Promise.all([api.getStatus(), api.listAccounts()])
        setStatus(s)
        setAccounts(a)
      } catch (e) {
        setError(String(e))
      }
    })()
  }, [])

  async function saveClient(): Promise<void> {
    setError(null)
    await api.setGoogleClient(clientId, clientSecret)
    setClientId('')
    setClientSecret('')
    await refresh()
  }

  async function connect(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      const { email } = await api.connectAccount()
      await refresh()
      await loadInbox(email)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function loadInbox(email: string): Promise<void> {
    setSelected(email)
    setInbox(null)
    setError(null)
    try {
      setInbox(await api.listInbox(email))
    } catch (e) {
      setError(String(e))
    }
  }

  async function remove(email: string): Promise<void> {
    await api.removeAccount(email)
    if (selected === email) {
      setSelected(null)
      setInbox(null)
    }
    await refresh()
  }

  return (
    <div style={{ font: '14px system-ui', display: 'flex', height: '100vh' }}>
      <aside style={{ width: 260, borderRight: '1px solid #ddd', padding: 16, overflow: 'auto' }}>
        <h1 style={{ fontSize: 18, marginTop: 0 }}>Cleoinbox</h1>

        {status && !status.hasGoogleClient && (
          <section style={{ marginBottom: 16 }}>
            <p style={{ color: '#a00' }}>Add your Google OAuth client to begin.</p>
            <input
              placeholder="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={{ width: '100%', marginBottom: 6 }}
            />
            <input
              placeholder="Client secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              style={{ width: '100%', marginBottom: 6 }}
            />
            <button onClick={() => saveClient().catch((e) => setError(String(e)))}>
              Save client
            </button>
          </section>
        )}

        {status?.hasGoogleClient && (
          <button onClick={connect} disabled={busy} style={{ marginBottom: 12 }}>
            {busy ? 'Connecting…' : 'Connect Gmail account'}
          </button>
        )}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {accounts.map((a) => (
            <li key={a.email} style={{ marginBottom: 8 }}>
              <button
                onClick={() => loadInbox(a.email)}
                style={{ fontWeight: selected === a.email ? 700 : 400 }}
              >
                {a.email}
              </button>
              <button onClick={() => remove(a.email)} style={{ marginLeft: 6, color: '#a00' }}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main style={{ flex: 1, padding: 16, overflow: 'auto' }}>
        {error && <p style={{ color: '#a00' }}>{error}</p>}
        {!selected && <p style={{ color: '#666' }}>Select an account to view its inbox.</p>}
        {selected && inbox === null && !error && <p style={{ color: '#666' }}>Loading…</p>}
        {inbox?.map((m) => (
          <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: m.unread ? 700 : 400 }}>{m.subject || '(no subject)'}</div>
            <div style={{ color: '#666' }}>{m.from}</div>
            <div style={{ color: '#999' }}>{m.snippet}</div>
          </div>
        ))}
      </main>
    </div>
  )
}

export default App
