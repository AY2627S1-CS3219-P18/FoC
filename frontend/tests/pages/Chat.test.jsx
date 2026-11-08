/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-05
 * Scope: Tests for Chat.jsx's mobile back arrow, created for instructions.md Stage 22's "Chat
 *        back arrow (mobile)" row: goes back to the previous in-app page, or to the current
 *        view's main page when there is none (opened directly by URL / new tab). Exercises the
 *        real routing/navigationHistory.js module (reset before each test) rather than mocking
 *        it, since that module's whole job is to distinguish the two cases.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Added live-chat API doubles and role/list/error tests.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Added the requested /chats list with titles, previews and conversation navigation.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Verified message submission and added send-button feedback and regression tests.
 * Author review:
 * Scope (2026-11-08, Codex, model: GPT-6): Tested realtime message merging and room lifecycle wiring.
 * Author review:
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Chat from '../../src/pages/Chat'
import { DemoProvider } from '../../src/context/DemoContext'
import { recordNavigation, resetNavigationHistory } from '../../src/routing/navigationHistory'

const realtime = vi.hoisted(() => ({ handlers: [], ready: [], useChatRoom: vi.fn() }))
vi.mock('../../src/realtime/chatSocket', () => ({
  useChatRoom: (...args) => realtime.useChatRoom(...args),
  useChatMessages: (handler) => { realtime.handlers.push(handler) },
  useChatReady: (handler) => { realtime.ready.push(handler) },
}))
const chatApi = vi.hoisted(() => ({
  listChats: vi.fn(), getChat: vi.fn(), listMessages: vi.fn(), sendMessage: vi.fn(), findOrderChat: vi.fn(),
}))
vi.mock('../../src/api/chat', () => chatApi)
const mockUseAuth = vi.fn()
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderChat(initialEntries) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <DemoProvider>
        <Routes>
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chats" element={<Chat />} />
          <Route path="/suppliers" element={<p>Suppliers page</p>} />
          <Route path="/requests" element={<p>Find errands page</p>} />
          <Route path="/some-other-page" element={<p>The previous page</p>} />
        </Routes>
      </DemoProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  chatApi.listChats.mockResolvedValue({ conversations: [], nextCursor: null, hasMore: false })
  chatApi.getChat.mockResolvedValue({ title: 'Errand chat', status: 'ACTIVE' })
  chatApi.listMessages.mockResolvedValue({ data: [], pagination: { hasMore: false, nextCursor: null } })
  realtime.handlers = []
  realtime.ready = []
  resetNavigationHistory()
  mockUseAuth.mockReturnValue({ user: { activeView: 'requester' } })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Chat back arrow', () => {
  it('opened directly (no previous in-app page) goes to the current view\'s main page', () => {
    renderChat(['/chat/r6'])
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.getByText('Suppliers page')).toBeInTheDocument()
  })

  it('goes to the courier main page when opened directly in courier view', () => {
    mockUseAuth.mockReturnValue({ user: { activeView: 'courier' } })
    renderChat(['/chat/r6'])
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.getByText('Find errands page')).toBeInTheDocument()
  })

  it('reached via in-app navigation goes back to the previous page', () => {
    // Simulates App.jsx's NavigationHistoryTracker having recorded a real PUSH/POP before Chat.
    recordNavigation()
    renderChat([{ pathname: '/some-other-page' }, { pathname: '/chat/r6' }])
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.getByText('The previous page')).toBeInTheDocument()
  })
})


describe('Live chat list', () => {
  it('loads requester chats and shows the empty state', async () => {
    renderChat(['/chats'])
    expect(await screen.findByText('No chats in requester mode.')).toBeInTheDocument()
    expect(chatApi.listChats).toHaveBeenCalledWith('requester', undefined)
  })

  it('filters the HTTP call by courier mode and opens the conversation ID', async () => {
    mockUseAuth.mockReturnValue({ user: { activeView: 'courier' } })
    chatApi.listChats.mockResolvedValue({ conversations: [{ id: 'conversation-1', orderId: 'order-1', updatedAt: '2026-11-08T00:00:00Z', lastMessage: null, unreadCount: 2 }], hasMore: false })
    renderChat(['/chats'])
    const link = await screen.findByRole('link', { name: /Errand chat/ })
    expect(link).toHaveAttribute('href', '/chat/conversation-1')
    expect(chatApi.listChats).toHaveBeenCalledWith('courier', undefined)
    expect(screen.getByText('2 unread')).toBeInTheDocument()
  })

  it('shows a failed list request and allows retry', async () => {
    chatApi.listChats.mockRejectedValueOnce(new Error('Chat service unavailable'))
    renderChat(['/chats'])
    expect(await screen.findByRole('alert')).toHaveTextContent('Chat service unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No chats in requester mode.')).toBeInTheDocument()
  })

  it('resolves an order ID to its conversation before opening', async () => {
    chatApi.findOrderChat.mockResolvedValue({ id: 'conversation-1' })
    renderChat(['/chat?orderId=order-1'])
    expect(await screen.findByText('Errand chat')).toBeInTheDocument()
    expect(chatApi.findOrderChat).toHaveBeenCalledWith('order-1', 'requester')
    expect(chatApi.getChat).toHaveBeenCalledWith('conversation-1')
  })
})


it('shows titles and previews in server update order, then opens messages on click', async () => {
  chatApi.listChats.mockResolvedValue({ conversations: [
    { id: 'new-chat', orderId: 'order-new', updatedAt: '2026-11-08T12:00:00Z', lastMessage: { content: 'Newest preview' }, unreadCount: 0 },
    { id: 'old-chat', orderId: 'order-old', updatedAt: '2026-11-07T12:00:00Z', lastMessage: { content: 'Older preview' }, unreadCount: 0 },
  ], hasMore: false })
  chatApi.getChat.mockImplementation(async (id) => ({ title: id === 'new-chat' ? 'Coffee errand' : 'Lunch errand', status: 'ACTIVE' }))
  chatApi.listMessages.mockResolvedValue({ data: [{ messageId: 'm-1', senderId: 'another-user', type: 'TEXT', content: 'Your coffee is ready', createdAt: '2026-11-08T12:00:00Z' }], pagination: { hasMore: false } })
  renderChat(['/chats'])
  const newest = await screen.findByRole('link', { name: /Coffee errand/ })
  const older = screen.getByRole('link', { name: /Lunch errand/ })
  expect(newest.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText('Newest preview')).toBeInTheDocument()
  fireEvent.click(newest)
  expect(await screen.findByText('Your coffee is ready')).toBeInTheDocument()
  expect(chatApi.listMessages).toHaveBeenCalledWith('new-chat')
})


it('sends the draft to the selected conversation and displays the saved message', async () => {
  chatApi.sendMessage.mockResolvedValue({ messageId: 'sent-1', senderId: 'me', type: 'TEXT', content: 'Hello courier', createdAt: '2026-11-08T12:00:00Z' })
  renderChat(['/chat/conversation-1'])
  const input = screen.getByRole('textbox', { name: 'Message' })
  await waitFor(() => expect(input).toBeEnabled())
  fireEvent.change(input, { target: { value: 'Hello courier' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  expect(await screen.findByText('Hello courier')).toBeInTheDocument()
  expect(chatApi.sendMessage).toHaveBeenCalledWith('conversation-1', 'Hello courier')
  expect(input).toHaveValue('')
})

it('retains the draft and shows an error when the endpoint rejects sending', async () => {
  chatApi.sendMessage.mockRejectedValue(new Error('Message could not be sent'))
  renderChat(['/chat/conversation-1'])
  const input = screen.getByRole('textbox', { name: 'Message' })
  await waitFor(() => expect(input).toBeEnabled())
  fireEvent.change(input, { target: { value: 'Keep this draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Message could not be sent')
  expect(input).toHaveValue('Keep this draft')
  expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled()
})


it('renders incoming socket messages once and ignores other conversations', async () => {
  renderChat(['/chat/conversation-1'])
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled())
  expect(realtime.useChatRoom).toHaveBeenCalledWith('conversation-1', expect.any(Function))
  const message = { messageId: 'live-1', conversationId: 'conversation-1', senderId: 'other', type: 'TEXT', content: 'Arrived live', createdAt: '2026-11-08T12:00:00Z' }
  await act(async () => {
    realtime.handlers.forEach((handler) => { handler(message); handler(message); handler({ ...message, conversationId: 'different', messageId: 'other', content: 'Wrong room' }) })
  })
  expect(screen.getAllByText('Arrived live')).toHaveLength(1)
  expect(screen.queryByText('Wrong room')).not.toBeInTheDocument()
})
