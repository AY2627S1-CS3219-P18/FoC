/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-11-09
 * Scope: Tests for the view toggle's redirect (George, 2026-11-09): switching view on a page
 *        that belongs only to the old view goes to the new view's main page, a shared page
 *        stays put, and a failed switch returns to the original page. useAuth is mocked with a
 *        mutable object whose setActiveView flips the view like AuthContext's optimistic update.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActiveViewToggle from '../../src/components/ActiveViewToggle'
import { VIEWS, viewForPath } from '../../src/routing/views'

const auth = vi.hoisted(() => ({
  user: { activeView: 'requester' },
  setActiveView: vi.fn(),
}))
const toast = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../../src/components/Toast', () => ({ useToast: () => toast }))

/** Optimistic flip, as AuthContext does; `fail` reverts and rethrows. */
function switching({ fail = false } = {}) {
  return vi.fn(async (view) => {
    const previous = auth.user.activeView
    auth.user = { activeView: view }
    if (fail) {
      auth.user = { activeView: previous }
      throw new Error('network down')
    }
  })
}

function renderAt(path) {
  const page = (name) => <p>{name}</p>
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ActiveViewToggle />
      <Routes>
        <Route path="/suppliers" element={page('Suppliers page')} />
        <Route path="/my-errands" element={page('My errands page')} />
        <Route path="/requests" element={page('Find errands page')} />
        <Route path="/my-deliveries" element={page('My deliveries page')} />
        <Route path="/account" element={page('Account page')} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  auth.user = { activeView: VIEWS.REQUESTER }
  auth.setActiveView = switching()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ActiveViewToggle: switching view from a page of the old view', () => {
  it('Suppliers in requester view -> courier goes to Find errands', async () => {
    renderAt('/suppliers')
    fireEvent.click(screen.getByRole('button', { name: /Courier/ }))
    await waitFor(() => expect(screen.getByText('Find errands page')).toBeInTheDocument())
    expect(auth.setActiveView).toHaveBeenCalledWith(VIEWS.COURIER)
  })

  it('and vice versa: My deliveries in courier view -> requester goes to Suppliers', async () => {
    auth.user = { activeView: VIEWS.COURIER }
    renderAt('/my-deliveries')
    fireEvent.click(screen.getByRole('button', { name: /Requester/ }))
    await waitFor(() => expect(screen.getByText('Suppliers page')).toBeInTheDocument())
    expect(auth.setActiveView).toHaveBeenCalledWith(VIEWS.REQUESTER)
  })

  it('stays on a page shared by both views', async () => {
    renderAt('/account')
    fireEvent.click(screen.getByRole('button', { name: /Courier/ }))
    await waitFor(() => expect(auth.setActiveView).toHaveBeenCalled())
    expect(screen.getByText('Account page')).toBeInTheDocument()
  })

  it('returns to the original page and shows a toast when the switch fails', async () => {
    auth.setActiveView = switching({ fail: true })
    renderAt('/my-errands')
    fireEvent.click(screen.getByRole('button', { name: /Courier/ }))
    await waitFor(() => expect(toast.showToast).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('My errands page')).toBeInTheDocument())
    expect(auth.user.activeView).toBe(VIEWS.REQUESTER)
  })
})

describe('viewForPath', () => {
  it.each([
    ['/suppliers', VIEWS.REQUESTER],
    ['/suppliers/12', VIEWS.REQUESTER],
    ['/requests/new', VIEWS.REQUESTER],
    ['/requests/abc/edit', VIEWS.REQUESTER],
    ['/my-errands', VIEWS.REQUESTER],
    ['/requests', VIEWS.COURIER],
    ['/my-deliveries', VIEWS.COURIER],
    ['/account', null],
    ['/chat', null],
  ])('%s -> %s', (path, view) => {
    expect(viewForPath(path)).toBe(view)
  })
})
