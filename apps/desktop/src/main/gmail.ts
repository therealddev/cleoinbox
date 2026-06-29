import { gmail } from '@googleapis/gmail'
import type { gmail_v1 } from '@googleapis/gmail'
import type { InboxMessage } from '@cleoinbox/shared'
import { getAuthClient } from './google-auth'

// Read-side Gmail access for v1: list the inbox. Filter create/list/delete
// (gmail.settings.basic) lands in steps 5 and 7.

const header = (msg: gmail_v1.Schema$Message, name: string): string =>
  msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

export async function listInbox(email: string, max = 25): Promise<InboxMessage[]> {
  const client = gmail({ version: 'v1', auth: getAuthClient(email) })
  const { data } = await client.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults: max
  })

  const ids = (data.messages ?? []).flatMap((m) => (m.id ? [m.id] : []))
  // Fetch each message independently — a message archived/deleted between the
  // list and the get (or a transient per-message error) drops that one row
  // instead of failing the whole inbox.
  const results = await Promise.allSettled(
    ids.map((id) =>
      client.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      })
    )
  )

  const inbox: InboxMessage[] = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const msg = result.value.data
    inbox.push({
      id: msg.id ?? '',
      threadId: msg.threadId ?? '',
      from: header(msg, 'From'),
      subject: header(msg, 'Subject'),
      date: header(msg, 'Date'),
      unread: msg.labelIds?.includes('UNREAD') ?? false,
      snippet: msg.snippet ?? ''
    })
  }
  return inbox
}
