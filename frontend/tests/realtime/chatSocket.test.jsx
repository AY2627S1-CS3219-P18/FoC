/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-08
 * Scope: Verified chat socket path, acknowledgements, reconnects and room cleanup.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const fake = vi.hoisted(() => ({ handlers: {}, connected: true, active: false, on: vi.fn(), emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn() }))
const factory = vi.hoisted(() => vi.fn(() => fake))
vi.mock('socket.io-client', () => ({ io: factory }))
vi.mock('../../src/api/http', () => ({ getAccessToken: () => 'token', refreshAccessToken: vi.fn() }))
import { connectChatSocket, disconnectChatSocket, useChatRoom, useChatReady } from '../../src/realtime/chatSocket'
afterEach(() => { disconnectChatSocket(); vi.clearAllMocks(); fake.handlers = {} })
it('joins on opening, rejoins after ready, reports errors and leaves on unmount', () => {
  fake.on.mockImplementation((name, handler) => { fake.handlers[name] = handler })
  connectChatSocket()
  expect(factory).toHaveBeenCalledWith(expect.objectContaining({ path: '/chat-socket.io', transports: ['websocket'] }))
  const onError = vi.fn(), ready = vi.fn()
  const hook = renderHook(() => { useChatRoom('conversation-1', onError); useChatReady(ready) })
  expect(fake.emit).toHaveBeenCalledWith('chat:join', 'conversation-1', expect.any(Function))
  const ack = fake.emit.mock.calls[0][2]
  act(() => ack({ success: false, error: { code: 403, message: 'Forbidden' } }))
  expect(onError).toHaveBeenCalledWith('Forbidden')
  fake.emit.mockClear()
  act(() => fake.handlers.ready())
  expect(fake.emit).toHaveBeenCalledWith('chat:join', 'conversation-1', expect.any(Function))
  expect(ready).toHaveBeenCalledOnce()
  hook.unmount()
  expect(fake.emit).toHaveBeenCalledWith('chat:leave', 'conversation-1', expect.any(Function))
  act(() => fake.handlers.disconnect('io server disconnect'))
  expect(fake.connect).toHaveBeenCalledTimes(2)
})
