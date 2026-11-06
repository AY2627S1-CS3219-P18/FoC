/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-04
 * Scope: Tests for the Stage 20b email eye icon (per instructions.md Stage 20b's Tests
 *        section): icon visibility, unmask/re-mask on click, the 60s auto-re-mask timer
 *        (Vitest fake timers, two rows unmasked independently), the failure toast, and
 *        re-masking on a table refetch. listUsers and getFullEmail are mocked.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-05
 * Scope: Stage 24 of instructions.md - renderPage now wraps in MemoryRouter (AdminUsers.jsx
 *        calls useNavigate unconditionally as of this stage, which throws outside a Router),
 *        plus a dummy /admin/user-transactions/:userId route to check the new row-click entry
 *        point: a row click navigates there, and the three-dot menu still opens without
 *        navigating. Mocked useBalance (api/lookups) for the new Credits column, and added a
 *        test for it, per the stage's "Summary fields" row for this table.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../src/components/Toast'
import AdminUsers from '../../src/pages/AdminUsers'
import { getFullEmail, listUsers } from '../../src/api/users'
import { useBalance } from '../../src/api/lookups'

vi.mock('../../src/api/users', () => ({
  listUsers: vi.fn(),
  getFullEmail: vi.fn(),
  unlockUser: vi.fn(),
  updateUserRole: vi.fn(),
  updateUserStatus: vi.fn(),
}))

vi.mock('../../src/api/lookups', () => ({
  useBalance: vi.fn(),
}))

const VIEWER = { id: 'admin-1', username: 'admin', role: 'admin' }

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: VIEWER,
    isLoggedIn: true,
    sessionReady: true,
    requireAuth: vi.fn(),
  }),
}))

function userRow(overrides) {
  return {
    id: 'user-1',
    username: 'alice',
    email: 'a***@example.com',
    status: 'active',
    role: 'user',
    activeView: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    isLocked: false,
    lockedUntil: null,
    lockLevel: 0,
    ...overrides,
  }
}

const ALICE = userRow({ id: 'user-1', username: 'alice', email: 'a***@example.com' })
const BOB = userRow({ id: 'user-2', username: 'bob', email: 'b***@example.com' })
const SELF_ROW = userRow({ id: VIEWER.id, username: 'admin', email: 'a***@example.com', role: 'admin' })
const SUPER_ADMIN_ROW = userRow({
  id: 'sa-1',
  username: 'root',
  email: 'r***@example.com',
  role: 'super admin',
})

function usersPage(users) {
  return { users, page: 1, pageSize: 50, total: users.length, totalPages: 1 }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route
            path="/admin/user-transactions/:userId"
            element={<p>User history page</p>}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useBalance.mockReturnValue(null)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AdminUsers email eye icon (Stage 20b)', () => {
  it('shows the eye icon only on other users\' rows, not on the caller\'s own row or a super admin row', async () => {
    listUsers.mockResolvedValue(usersPage([ALICE, SELF_ROW, SUPER_ADMIN_ROW]))
    renderPage()

    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show email for alice' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /email for admin/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /email for root/i })).not.toBeInTheDocument()
  })

  it('reveals the full email on click and re-masks on a second click with no further request', async () => {
    listUsers.mockResolvedValue(usersPage([ALICE]))
    const emailPromise = Promise.resolve({ email: 'alice@example.com' })
    getFullEmail.mockReturnValueOnce(emailPromise)
    renderPage()

    const eyeButton = await screen.findByRole('button', { name: 'Show email for alice' })
    fireEvent.click(eyeButton)
    await act(async () => {
      await emailPromise
    })

    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(getFullEmail).toHaveBeenCalledWith('user-1')
    expect(getFullEmail).toHaveBeenCalledTimes(1)

    const hideButton = screen.getByRole('button', { name: 'Hide email for alice' })
    fireEvent.click(hideButton)

    expect(screen.getByText('a***@example.com')).toBeInTheDocument()
    expect(getFullEmail).toHaveBeenCalledTimes(1)
  })

  it('auto re-masks 60 seconds after unmasking', async () => {
    listUsers.mockResolvedValue(usersPage([ALICE]))
    const emailPromise = Promise.resolve({ email: 'alice@example.com' })
    getFullEmail.mockReturnValueOnce(emailPromise)
    renderPage()

    const eyeButton = await screen.findByRole('button', { name: 'Show email for alice' })

    vi.useFakeTimers()
    fireEvent.click(eyeButton)
    await act(async () => {
      await emailPromise
    })
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(59_999)
    })
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByText('a***@example.com')).toBeInTheDocument()
  })

  it('re-masks two unmasked rows independently, each on its own 60s timer', async () => {
    listUsers.mockResolvedValue(usersPage([ALICE, BOB]))
    const aliceEmail = Promise.resolve({ email: 'alice@example.com' })
    const bobEmail = Promise.resolve({ email: 'bob@example.com' })
    getFullEmail.mockImplementation((id) => (id === 'user-1' ? aliceEmail : bobEmail))
    renderPage()

    const aliceEye = await screen.findByRole('button', { name: 'Show email for alice' })

    vi.useFakeTimers()
    fireEvent.click(aliceEye)
    await act(async () => {
      await aliceEmail
    })
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    const bobEye = screen.getByRole('button', { name: 'Show email for bob' })
    fireEvent.click(bobEye)
    await act(async () => {
      await bobEmail
    })
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()

    // 30s + 30s = 60s elapsed for alice; bob has only had 30s.
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText('a***@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()

    // Bob now reaches 60s.
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText('b***@example.com')).toBeInTheDocument()
  })

  it('shows a failure toast and leaves the row masked when getFullEmail fails', async () => {
    listUsers.mockResolvedValue(usersPage([ALICE]))
    getFullEmail.mockRejectedValueOnce({ code: 'USER_NOT_FOUND' })
    renderPage()

    const eyeButton = await screen.findByRole('button', { name: 'Show email for alice' })
    fireEvent.click(eyeButton)

    expect(await screen.findByRole('status')).toHaveTextContent('That user could not be found.')
    expect(screen.getByText('a***@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show email for alice' })).toBeInTheDocument()
  })

  it('re-masks every row after the table refetches (e.g. a filter change)', async () => {
    // A fresh object per call, like a real response, so the refetch is a genuinely new `data`
    // reference (mockResolvedValue would reuse one object's identity across calls, hiding the
    // effect this test is checking).
    listUsers.mockImplementation(() => Promise.resolve(usersPage([ALICE])))
    const emailPromise = Promise.resolve({ email: 'alice@example.com' })
    getFullEmail.mockReturnValueOnce(emailPromise)
    renderPage()

    const eyeButton = await screen.findByRole('button', { name: 'Show email for alice' })
    fireEvent.click(eyeButton)
    await act(async () => {
      await emailPromise
    })
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'active' } })

    await waitFor(() => {
      expect(screen.getByText('a***@example.com')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Show email for alice' })).toBeInTheDocument()
  })
})

describe('AdminUsers row click (Stage 24 entry point)', () => {
  it('clicking a row opens that user\'s history page', async () => {
    listUsers.mockResolvedValue(usersPage([ALICE]))
    renderPage()

    const row = (await screen.findByText('alice')).closest('tr')
    fireEvent.click(row)

    expect(await screen.findByText('User history page')).toBeInTheDocument()
  })

  it('the three-dot menu still opens on click, without navigating', async () => {
    listUsers.mockResolvedValue(usersPage([ALICE]))
    renderPage()

    await screen.findByText('alice')
    fireEvent.click(screen.getByRole('button', { name: 'Actions for alice' }))

    expect(await screen.findByRole('menuitem', { name: 'Suspend' })).toBeInTheDocument()
    expect(screen.queryByText('User history page')).not.toBeInTheDocument()
  })
})

describe('AdminUsers Credits column (Stage 24 Summary fields)', () => {
  it('shows the balance when it resolves', async () => {
    listUsers.mockResolvedValue(usersPage([ALICE]))
    useBalance.mockReturnValue({
      userId: 'user-1',
      totalBalance: 42,
      reservedBalance: 2,
      unreservedBalance: 40,
    })
    renderPage()

    expect(await screen.findByText('42')).toBeInTheDocument()
  })

  it('shows a dash while the balance has not resolved', async () => {
    listUsers.mockResolvedValue(usersPage([ALICE]))
    useBalance.mockReturnValue(null)
    renderPage()

    await screen.findByText('alice')
    // Both the Credits and Locked columns fall back to "—" for this row.
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
