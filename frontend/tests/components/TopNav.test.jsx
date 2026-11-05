/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-05
 * Scope: Tests for TopNav.jsx, created for instructions.md Stage 22's "Nav bar (logged in)" and
 *        "Nav bar (logged out)" rows.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TopNav from '../../src/components/TopNav'
import { ToastProvider } from '../../src/components/Toast'

const mockUseAuth = vi.fn()
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const NO_CREDITS = { available: 0, reserved: 0, total: 0 }

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/suppliers']}>
      <ToastProvider>
        <TopNav />
      </ToastProvider>
    </MemoryRouter>,
  )
}

// TopNav renders each nav link twice (desktop <nav> + mobile drawer), so assertions use
// getAllByRole / queryAllByRole rather than requiring a single match.
describe('TopNav', () => {
  it('requester view: shows Suppliers and My errands, not Find errands or My deliveries', () => {
    mockUseAuth.mockReturnValue({
      isLoggedIn: true,
      user: { username: 'alice', activeView: 'requester' },
      credits: NO_CREDITS,
      requireAuth: vi.fn(),
      logout: vi.fn(),
      isAdmin: false,
    })
    renderNav()

    expect(screen.getAllByRole('link', { name: 'Suppliers' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'My errands' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Find errands' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My deliveries' })).not.toBeInTheDocument()
  })

  it('courier view: shows Find errands and My deliveries, not Suppliers or My errands', () => {
    mockUseAuth.mockReturnValue({
      isLoggedIn: true,
      user: { username: 'bob', activeView: 'courier' },
      credits: NO_CREDITS,
      requireAuth: vi.fn(),
      logout: vi.fn(),
      isAdmin: false,
    })
    renderNav()

    expect(screen.getAllByRole('link', { name: 'Find errands' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'My deliveries' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Suppliers' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My errands' })).not.toBeInTheDocument()
  })

  it('shows the admin links alongside the current view\'s links for an admin', () => {
    mockUseAuth.mockReturnValue({
      isLoggedIn: true,
      user: { username: 'admin', activeView: 'requester' },
      credits: NO_CREDITS,
      requireAuth: vi.fn(),
      logout: vi.fn(),
      isAdmin: true,
    })
    renderNav()

    expect(screen.getAllByRole('link', { name: 'Suppliers' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Manage suppliers' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Manage users' }).length).toBeGreaterThan(0)
  })

  it('logged out: no page links, only Log in and Register', () => {
    mockUseAuth.mockReturnValue({
      isLoggedIn: false,
      user: null,
      credits: NO_CREDITS,
      requireAuth: vi.fn(),
      logout: vi.fn(),
      isAdmin: false,
    })
    renderNav()

    for (const label of ['Suppliers', 'Find errands', 'My errands', 'My deliveries']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: 'Log in' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Register' }).length).toBeGreaterThan(0)
  })
})
