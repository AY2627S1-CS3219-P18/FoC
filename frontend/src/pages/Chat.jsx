/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5), date: 2026-09-08
 * Scope: Generated UI mockup component Chat.jsx from team-authored blueprint.md.
 *        Visual/layout implementation only. No requirements, architecture, or
 *        schema decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
 *
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope: Login prompt waits for the session restore (sessionReady), as Wallet.jsx does, so a
 *        reload while signed in no longer opens it.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
 * Scope: /chat/:id is now wrapped in RequireAuth (App.jsx), which replaces the gating effect
 *        that opened the deleted LoginModal via requireLogin, per instructions.md Stage 16b.
 *        `currentUser`/`requests` stay on DemoContext (mocked chat data, unrelated to auth).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-05
 * Scope: Per instructions.md Stage 22's "Chat back arrow (mobile)" row: the mobile back arrow
 *        now goes back to the previous in-app page (navigate(-1)) instead of the fixed
 *        /activity link, or to the current view's main page when there is no previous in-app
 *        page (opened directly by URL or in a new tab), using the new
 *        routing/navigationHistory.js tracker.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Connected the team-requested frontend chat entry points and existing HTTP contracts.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Added the requested /chats list with titles, previews and conversation navigation.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Verified message submission and added send-button feedback and regression tests.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Implemented team-specified chat room subscriptions and realtime frontend updates.
 * Author review:
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { findOrderChat, getChat, listChats, listMessages, sendMessage } from '../api/chat'
import { useChatRoom, useChatMessages, useChatReady } from '../realtime/chatSocket'
import { hasPreviousPage } from '../routing/navigationHistory'
import { mainPageFor } from '../routing/views'

export default function Chat() {
  const { user } = useAuth()
  return <ChatView key={user?.activeView} />
}

// Listing supplies authoritative updatedAt DESC ordering; details supplies each stored title.
async function loadChatPage(role, cursor) {
  const page = await listChats(role, cursor)
  const conversations = await Promise.all(page.conversations.map(async (chat) => {
    const details = await getChat(chat.id)
    return { ...chat, title: details.title }
  }))
  return { ...page, conversations }
}

function ChatView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const orderId = params.get('orderId')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [retry, setRetry] = useState(0)
  useChatMessages(() => setRetry((v) => v + 1))
  useChatReady(() => setRetry((v) => v + 1))
  const role = user?.activeView
  useEffect(() => {
    let live = true
    setPage(null)
    setError(null)
    setLoading(true)
    const load = orderId ? findOrderChat(orderId, role) : loadChatPage(role)
    load.then((result) => {
      if (!live) return
      if (orderId) navigate('/chat/' + result.id, { replace: true })
      else setPage(result)
    }).catch((err) => { if (live) setError(err.message) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [role, orderId, navigate, retry])

  const more = async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await loadChatPage(role, page.nextCursor)
      setPage((prev) => ({ ...next, conversations: [...prev.conversations, ...next.conversations] }))
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  const goBack = () => hasPreviousPage() ? navigate(-1) : navigate(mainPageFor(role))
  return (
    <div className="page-width page-gutter py-6">
      <button type="button" onClick={goBack} aria-label="Go back" className="mb-4 flex h-11 items-center gap-2"><ArrowLeft size={20} /> Back</button>
      <div className="flex gap-6">
        <aside className={(id ? 'hidden md:block ' : '') + (id ? 'w-full md:w-80 ' : 'w-full ') + 'shrink-0 rounded-card border border-line bg-surface p-4'}>
          <h1 className="mb-4 text-lg font-semibold">Chats</h1>
          {error && <div role="alert">{error} <button onClick={() => setRetry((v) => v + 1)}>Retry</button></div>}
          {loading && <p role="status">Loading chats…</p>}
          {page?.conversations.length === 0 && <p>No chats in {role} mode.</p>}
          <ul>{page?.conversations.map((chat) => <li key={chat.id} className="border-b border-line last:border-0">
            <Link to={'/chat/' + chat.id} aria-current={id === chat.id ? 'page' : undefined} className="flex items-center gap-3 rounded-btn px-2 py-4 hover:bg-surface-alt">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-alt text-ink-70"><MessageCircle size={22} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold">{chat.title}</span>
                  <time dateTime={chat.updatedAt} className="shrink-0 text-xs text-ink-40">{new Date(chat.updatedAt).toLocaleString()}</time>
                </span>
                <span className="mt-1 block truncate text-sm text-ink-70">{chat.lastMessage?.content ?? (chat.lastMessage ? chat.lastMessage.type : 'No messages yet')}</span>
              </span>
              {chat.unreadCount > 0 && <span className="shrink-0 rounded-pill bg-ink px-2 py-1 text-xs text-white">{chat.unreadCount} unread</span>}
            </Link>
          </li>)}</ul>
          {page?.hasMore && <button disabled={loading} onClick={more}>Load more chats</button>}
        </aside>
        {id && <Thread key={id + ':' + role} id={id} user={user} />}
      </div>
    </div>
  )
}

// HTTP responses and socket delivery may arrive in either order; retain one row per saved ID.
function mergeMessages(previous, incoming) {
  return [...new Map([...previous, ...incoming].map((message) => [message.messageId, message])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId))
}

function Thread({ id, user }) {
  const [chat, setChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [pagination, setPagination] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [retry, setRetry] = useState(0)
  useChatRoom(id, (message) => { if (message) setError(message) })
  useChatReady(() => setRetry((v) => v + 1))
  useChatMessages((message) => {
    if (message.conversationId !== id) return
    setMessages((prev) => mergeMessages(prev, [message]))
  })
  useEffect(() => {
    let live = true
    setBusy(true)
    setError(null)
    Promise.all([getChat(id), listMessages(id)]).then(([details, history]) => {
      if (!live) return
      setChat(details)
      setMessages((prev) => mergeMessages(prev, history.data))
      setPagination(history.pagination)
    }).catch((err) => { if (live) setError(err.message) })
      .finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [id, retry])
  const older = async () => {
    setBusy(true)
    setError(null)
    try {
      const history = await listMessages(id, pagination.nextCursor)
      setMessages((prev) => mergeMessages(prev, history.data))
      setPagination(history.pagination)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  const send = async (event) => {
    event.preventDefault()
    if (!text.trim() || busy || chat?.status !== 'ACTIVE') return
    setBusy(true)
    setError(null)
    try {
      const message = await sendMessage(id, text)
      setMessages((prev) => mergeMessages(prev, [message]))
      setText('')
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <section className="min-w-0 flex-1 rounded-card border border-line p-4">
    <Link to="/chats">All chats</Link>
    <h2 className="text-lg font-semibold">{chat?.title ?? 'Chat'}</h2>
    <button onClick={() => setRetry((v) => v + 1)} disabled={busy}>Refresh messages</button>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Loading…</p>}
    {pagination?.hasMore && <button onClick={older} disabled={busy}>Load older messages</button>}
    <ol className="my-4 max-h-[60vh] space-y-3 overflow-y-auto">{messages.map((message) => <li key={message.messageId} className={message.senderId === user?.id ? 'text-right' : ''}>
      <p className={message.type === 'SYSTEM' ? 'text-center text-ink-70' : ''}>{message.content}</p>
      <time className="text-xs text-ink-40">{new Date(message.createdAt).toLocaleString()}</time>
    </li>)}</ol>
    <form onSubmit={send} className="flex gap-2">
      <input aria-label="Message" value={text} onChange={(event) => setText(event.target.value)} disabled={busy || !chat || chat.status !== 'ACTIVE'} className="min-w-0 flex-1 rounded-btn border border-line p-3" />
      <button type="submit" aria-label="Send message" disabled={busy || !text.trim() || chat?.status !== 'ACTIVE'} className="flex items-center gap-2 rounded-btn bg-ink px-4 text-white disabled:opacity-50"><Send size={20} aria-hidden="true" /> Send</button>
    </form>
  </section>
}
