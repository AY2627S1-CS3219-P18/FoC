/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-05
 * Scope: Tests for ViewGate (components/RouteGuards.jsx), created for instructions.md Stage
 *        22's "Opening another view's page" and "Toggling the view" rows. useAuth is mocked
 *        with a mutable, vi.hoisted object so the "Switch to <view>" button's call to
 *        setActiveView can simulate AuthContext's real optimistic update: ViewGate re-renders
 *        on its own setSwitching state change and reads the mutated mock on that render,
 *        exactly as it would re-render when the real AuthContext's user.activeView changes.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ViewGate } from '../../src/components/RouteGuards'
import { VIEWS } from '../../src/routing/views'

const auth = vi.hoisted(() => ({
  user: { activeView: 'requester' },
  setActiveView: vi.fn(),
}))

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => auth,
}))

function renderGated(requiredView, { initialPath = '/gated' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/gated"
          element={
            <ViewGate requiredView={requiredView}>
              <p>Protected page</p>
            </ViewGate>
          }
        />
        <Route path="/suppliers" element={<p>Suppliers page</p>} />
        <Route path="/requests" element={<p>Find errands page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  auth.user = { activeView: VIEWS.REQUESTER }
  auth.setActiveView = vi.fn()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ViewGate', () => {
  it('renders the page when the current view matches', () => {
    renderGated(VIEWS.REQUESTER)
    expect(screen.getByText('Protected page')).toBeInTheDocument()
  })

  it('shows the blocked-page message, URL unchanged, when the view does not match', () => {
    renderGated(VIEWS.COURIER)
    expect(screen.queryByText('Protected page')).not.toBeInTheDocument()
    expect(screen.getByText('This is only available in courier mode')).toBeInTheDocument()
  })

  it('and the reverse: a requester-only page blocked in courier view names "requester mode"', () => {
    auth.user = { activeView: VIEWS.COURIER }
    renderGated(VIEWS.REQUESTER)
    expect(screen.getByText('This is only available in requester mode')).toBeInTheDocument()
  })

  it('the switch button switches the view and the page then renders, URL unchanged', async () => {
    auth.setActiveView = vi.fn(async (view) => {
      auth.user = { activeView: view }
    })
    renderGated(VIEWS.COURIER)

    fireEvent.click(screen.getByRole('button', { name: /Switch to Find errands/ }))

    await waitFor(() => expect(screen.getByText('Protected page')).toBeInTheDocument())
    expect(auth.setActiveView).toHaveBeenCalledWith(VIEWS.COURIER)
    expect(screen.queryByText(/This is only available/)).not.toBeInTheDocument()
  })

  it('the main-page button goes to the current view\'s main page without changing the view', () => {
    renderGated(VIEWS.COURIER)

    fireEvent.click(screen.getByRole('button', { name: 'Go to Suppliers' }))

    expect(screen.getByText('Suppliers page')).toBeInTheDocument()
    expect(auth.setActiveView).not.toHaveBeenCalled()
  })

  it('shows a retry message if switching the view fails', async () => {
    auth.setActiveView = vi.fn().mockRejectedValue(new Error('network down'))
    renderGated(VIEWS.COURIER)

    fireEvent.click(screen.getByRole('button', { name: /Switch to Find errands/ }))

    await waitFor(() =>
      expect(screen.getByText('Could not switch views. Try again.')).toBeInTheDocument(),
    )
    expect(screen.getByText('This is only available in courier mode')).toBeInTheDocument()
  })
})
