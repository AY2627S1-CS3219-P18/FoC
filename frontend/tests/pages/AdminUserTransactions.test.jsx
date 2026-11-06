/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-05
 * Scope: Tests for the new admin user-history page (instructions.md Stage 24, F5.3.2): profile
 *        rendering, the whole-page "user not found" on a 404, an empty-orders state, the
 *        orders section's own error+retry, client-side role/status filtering of the current
 *        page, navigating to the order page on a row click, and suspend/promote behaving like
 *        /admin/users (confirm dialog, success toast + in-place profile update, failure toast +
 *        profile reload). getUser/updateUserStatus/updateUserRole, listUserOrders and the
 *        lookups hooks are mocked.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-06
 * Scope: Stage 26e - the shared ConfirmActionDialog now requires a reason to be selected
 *        before Confirm is enabled; the two "profile actions" tests now select one and assert
 *        it is forwarded to updateUserStatus.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../src/components/Toast'
import AdminUserTransactions from '../../src/pages/AdminUserTransactions'
import { getUser, updateUserRole, updateUserStatus } from '../../src/api/users'
import { listUserOrders } from '../../src/api/orders'

vi.mock('../../src/api/users', () => ({
  getUser: vi.fn(),
  updateUserStatus: vi.fn(),
  updateUserRole: vi.fn(),
}))

vi.mock('../../src/api/orders', () => ({
  listUserOrders: vi.fn(),
}))

vi.mock('../../src/api/lookups', () => ({
  useUserName: () => null,
  useSupplier: () => null,
}))

const VIEWER = { id: 'admin-1', username: 'admin', role: 'admin' }
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: VIEWER, isLoggedIn: true, sessionReady: true, requireAuth: vi.fn() }),
}))

function profile(overrides) {
  return {
    id: 'user-1',
    username: 'alice',
    email: 'alice@example.com',
    status: 'active',
    role: 'user',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function order(overrides) {
  return {
    id: 'order-aaaaaaaa-1111',
    requesterId: 'user-1',
    supplierId: 1,
    credits: 10,
    status: 'completed',
    courierId: 'user-2',
    ...overrides,
  }
}

function ordersPage(entries, overrides) {
  return {
    totalCount: entries.length,
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    orders: entries,
    ...overrides,
  }
}

function renderPage(initialEntries = ['/admin/user-transactions/user-1']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/users" element={<p>Admin users page</p>} />
          <Route path="/admin/user-transactions/:userId" element={<AdminUserTransactions />} />
          <Route
            path="/admin/user-transactions/:userId/:requestId"
            element={<p>Order history page</p>}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminUserTransactions profile section', () => {
  it('shows the profile fields', async () => {
    getUser.mockResolvedValue(profile())
    listUserOrders.mockResolvedValue(ordersPage([]))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'alice' })).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('a 404 on the profile call shows "User not found" for the whole page', async () => {
    getUser.mockRejectedValue({ status: 404, message: 'not found' })
    listUserOrders.mockResolvedValue(ordersPage([]))
    renderPage()

    expect(await screen.findByText('User not found')).toBeInTheDocument()
    expect(screen.queryByText('Orders')).not.toBeInTheDocument()
  })

  it('a malformed/nonexistent user id shows the same "User not found" view', async () => {
    getUser.mockRejectedValue({ status: 404, message: 'not found' })
    listUserOrders.mockResolvedValue(ordersPage([]))
    renderPage(['/admin/user-transactions/not-a-real-id'])

    expect(await screen.findByText('User not found')).toBeInTheDocument()
  })
})

describe('AdminUserTransactions orders section', () => {
  it('a user with no orders shows an empty state', async () => {
    getUser.mockResolvedValue(profile())
    listUserOrders.mockResolvedValue(ordersPage([]))
    renderPage()

    expect(await screen.findByText('No orders yet')).toBeInTheDocument()
  })

  it('an order-service failure errors only the orders section, with a working retry', async () => {
    getUser.mockResolvedValue(profile())
    listUserOrders.mockRejectedValueOnce({ status: 503, message: 'Order service unavailable.' })
    listUserOrders.mockResolvedValueOnce(ordersPage([{ order: order(), role: 'requester' }]))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'alice' })).toBeInTheDocument()
    expect(await screen.findByText('Order service unavailable.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(listUserOrders).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('cell', { name: 'Completed' })).toBeInTheDocument()
  })

  it('role and status filters narrow the current page, and the UI says so', async () => {
    getUser.mockResolvedValue(profile())
    listUserOrders.mockResolvedValue(
      ordersPage([
        { order: order({ id: 'order-req', status: 'completed' }), role: 'requester' },
        { order: order({ id: 'order-cour', status: 'open' }), role: 'courier' },
      ]),
    )
    renderPage()

    expect(await screen.findByRole('cell', { name: 'Completed' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Open' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: 'courier' } })

    expect(screen.queryByRole('cell', { name: 'Completed' })).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Open' })).toBeInTheDocument()
    expect(screen.getByText('Filters apply to this page of orders only.')).toBeInTheDocument()
  })

  it('clicking an order row opens the order history page', async () => {
    getUser.mockResolvedValue(profile())
    listUserOrders.mockResolvedValue(ordersPage([{ order: order(), role: 'requester' }]))
    renderPage()

    const cell = await screen.findByText('order-aa')
    fireEvent.click(cell.closest('tr'))

    expect(await screen.findByText('Order history page')).toBeInTheDocument()
  })

  it('keeps the page number across a reload via the URL', async () => {
    getUser.mockResolvedValue(profile())
    listUserOrders.mockResolvedValue(ordersPage([], { currentPage: 2, totalPages: 3 }))
    renderPage(['/admin/user-transactions/user-1?page=2'])

    await screen.findByRole('heading', { name: 'alice' })
    await waitFor(() => expect(listUserOrders).toHaveBeenCalledWith('user-1', 2))
  })
})

describe('AdminUserTransactions profile actions', () => {
  it('suspending shows the confirm dialog, then a success toast and updates the profile in place', async () => {
    getUser.mockResolvedValue(profile({ status: 'active' }))
    listUserOrders.mockResolvedValue(ordersPage([]))
    updateUserStatus.mockResolvedValue(profile({ status: 'suspended' }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'FRAUD_OR_SCAM' } })
    const suspendButtons = screen.getAllByRole('button', { name: 'Suspend' })
    fireEvent.click(suspendButtons[suspendButtons.length - 1])

    expect(await screen.findByRole('status')).toHaveTextContent('alice was suspended.')
    expect(updateUserStatus).toHaveBeenCalledWith('user-1', 'suspended', { reason: 'FRAUD_OR_SCAM' })
    expect(getUser).toHaveBeenCalledTimes(1) // no reload needed on success
  })

  it('a failed action shows an error toast and reloads the profile', async () => {
    getUser.mockResolvedValue(profile({ status: 'active' }))
    listUserOrders.mockResolvedValue(ordersPage([]))
    updateUserStatus.mockRejectedValue({ code: 'USER_NOT_FOUND' })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }))
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'FRAUD_OR_SCAM' } })
    const suspendButtons = screen.getAllByRole('button', { name: 'Suspend' })
    fireEvent.click(suspendButtons[suspendButtons.length - 1])

    expect(await screen.findByRole('status')).toHaveTextContent('That user could not be found.')
    await waitFor(() => expect(getUser).toHaveBeenCalledTimes(2))
  })
})
