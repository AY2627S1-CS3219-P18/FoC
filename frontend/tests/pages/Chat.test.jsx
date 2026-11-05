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
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Chat from '../../src/pages/Chat'
import { DemoProvider } from '../../src/context/DemoContext'
import { recordNavigation, resetNavigationHistory } from '../../src/routing/navigationHistory'

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
          <Route path="/suppliers" element={<p>Suppliers page</p>} />
          <Route path="/requests" element={<p>Find errands page</p>} />
          <Route path="/some-other-page" element={<p>The previous page</p>} />
        </Routes>
      </DemoProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
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
