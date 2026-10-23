/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-23
 * Scope: Created the admin user-management page, per instructions.md Stage 16g: a searchable,
 *        filterable, sortable, paginated user table with per-row suspend/unsuspend and
 *        promote/demote actions, gated to exactly what user-service's PUT /users/:id/status
 *        and PUT /users/:id/role would allow (mirrored from users.service.ts's changeUserStatus
 *        and changeUserRole). Reached via the "Manage users" nav link added to TopNav.jsx in
 *        Stage 16b.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, MoreVertical } from 'lucide-react'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { Pager, useApiNotice } from '../components/ApiNotice'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../api/useApi'
import { listUsers, updateUserRole, updateUserStatus } from '../api/users'
import { describeError } from '../api/errorMessages'

const inputClass =
  'h-11 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink md:h-10 md:text-sm'
const selectClass =
  'h-11 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink md:h-10'

const STATUS_LABELS = { pending: 'Pending', active: 'Active', suspended: 'Suspended' }
const STATUS_TONES = {
  pending: 'border-line text-ink-40',
  active: 'border-blue text-blue',
  suspended: 'border-alert text-alert',
}
const ROLE_LABELS = { user: 'User', admin: 'Admin', 'super admin': 'Super admin' }
const ROLE_TONES = {
  user: 'border-line text-ink-70',
  admin: 'border-blue text-blue',
  'super admin': 'border-orange text-orange',
}

function Badge({ tone, children }) {
  return (
    <span
      className={
        'inline-flex h-5 items-center rounded-pill border bg-surface px-2 text-[11px] font-medium ' +
        tone
      }
    >
      {children}
    </span>
  )
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Mirrors user-service's changeUserStatus/changeUserRole (src/services/users.service.ts)
// exactly, so the menu never offers an action the backend would reject. Returns the action each
// control performs, or null to hide it; both null means "no menu" for that row.
function getRowActions(viewer, row) {
  if (row.id === viewer.id) return { suspend: null, role: null }
  if (row.role === 'super admin') return { suspend: null, role: null }
  if (row.status === 'pending') return { suspend: null, role: null }

  const viewerIsSuperAdmin = viewer.role === 'super admin'

  let suspend = null
  if (viewerIsSuperAdmin || row.role === 'user') {
    suspend = row.status === 'suspended' ? 'unsuspend' : 'suspend'
  }

  let role = null
  if (viewerIsSuperAdmin && row.status === 'active') {
    role = row.role === 'user' ? 'promote' : 'demote'
  }

  return { suspend, role }
}

const ACTION_SUCCESS = {
  suspend: (name) => name + ' was suspended.',
  unsuspend: (name) => name + ' was unsuspended.',
  promote: (name) => name + ' was promoted to admin.',
  demote: (name) => name + ' was demoted to user.',
}

const ACTION_DIALOG = {
  suspend: {
    title: (name) => 'Suspend ' + name + '?',
    body: 'They will be signed out everywhere and unable to log back in until unsuspended.',
    confirmLabel: 'Suspend',
    variant: 'danger',
  },
  unsuspend: {
    title: (name) => 'Unsuspend ' + name + '?',
    body: 'They will be able to log in again.',
    confirmLabel: 'Unsuspend',
    variant: 'primary',
  },
  promote: {
    title: (name) => 'Promote ' + name + ' to admin?',
    body: 'They will be signed out everywhere and gain admin access on their next login.',
    confirmLabel: 'Promote',
    variant: 'primary',
  },
  demote: {
    title: (name) => 'Demote ' + name + ' to user?',
    body: 'They will be signed out everywhere and lose admin access on their next login.',
    confirmLabel: 'Demote',
    variant: 'danger',
  },
}

function ConfirmActionDialog({ user, action, busy, onCancel, onConfirm }) {
  const spec = ACTION_DIALOG[action]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-labelledby="confirm-action-title"
        className="foc-fade relative w-full max-w-md rounded-t-card bg-surface p-5 shadow-modal sm:rounded-card"
      >
        <h2 id="confirm-action-title" className="text-lg font-semibold text-ink">
          {spec.title(user.username)}
        </h2>
        <p className="mt-2 text-sm text-ink-70">{spec.body}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={spec.variant} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : spec.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Three-dot menu: visible on row hover (desktop), always visible below the `sm` breakpoint
// (touch / small screens have no hover).
function RowMenu({ user, viewer, onPick }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDocMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const actions = getRowActions(viewer, user)
  const items = []
  if (actions.suspend === 'suspend') items.push({ key: 'suspend', label: 'Suspend' })
  if (actions.suspend === 'unsuspend') items.push({ key: 'unsuspend', label: 'Unsuspend' })
  if (actions.role === 'promote') items.push({ key: 'promote', label: 'Promote to admin' })
  if (actions.role === 'demote') items.push({ key: 'demote', label: 'Demote to user' })

  if (items.length === 0) return null

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        aria-label={'Actions for ' + user.username}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-btn text-ink-70 hover:bg-surface-alt hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-card border border-line bg-surface shadow-modal"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onPick(item.key)
              }}
              className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-alt"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const SORTABLE = { username: 'Username', email: 'Email', createdAt: 'Created' }

function SortHeader({ column, sortBy, sortDir, onToggle }) {
  const active = sortBy === column
  return (
    <th scope="col" className="py-2 pr-2 text-left font-medium">
      <button
        type="button"
        onClick={() => onToggle(column)}
        className="flex items-center gap-1 hover:text-ink"
      >
        {SORTABLE[column]}
        {active &&
          (sortDir === 'asc' ? (
            <ChevronUp size={14} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} aria-hidden="true" />
          ))}
      </button>
    </th>
  )
}

export default function AdminUsers() {
  const { user: viewer } = useAuth()
  const { showToast } = useToast()

  const [usernameInput, setUsernameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState(null) // { user, action }
  const [busy, setBusy] = useState(false)
  // Patches successful actions into the current page's rows until the next load replaces them.
  const [rowOverrides, setRowOverrides] = useState({})

  useEffect(() => {
    const t = setTimeout(() => setUsername(usernameInput.trim()), 300)
    return () => clearTimeout(t)
  }, [usernameInput])
  useEffect(() => {
    const t = setTimeout(() => setEmail(emailInput.trim()), 300)
    return () => clearTimeout(t)
  }, [emailInput])
  useEffect(() => {
    setPage(1)
  }, [username, email, status, role, sortBy, sortDir])

  const params = useMemo(
    () => ({ page, username, email, status, role, sortBy, sortDir }),
    [page, username, email, status, role, sortBy, sortDir],
  )
  const { data, loading, error, reload } = useApi(() => listUsers(params), [params])
  const notice = useApiNotice({ loading: loading && !data, error }, 'users')
  const rows = (data?.users ?? []).map((u) => rowOverrides[u.id] ?? u)

  useEffect(() => {
    setRowOverrides({})
  }, [data])

  function toggleSort(column) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
  }

  async function runAction(targetUser, action) {
    setBusy(true)
    try {
      const updated =
        action === 'suspend' || action === 'unsuspend'
          ? await updateUserStatus(targetUser.id, action === 'suspend' ? 'suspended' : 'active')
          : await updateUserRole(targetUser.id, action === 'promote' ? 'admin' : 'user')
      setRowOverrides((prev) => ({ ...prev, [updated.id]: updated }))
      setConfirm(null)
      showToast(ACTION_SUCCESS[action](targetUser.username), 'success')
    } catch (err) {
      setConfirm(null)
      showToast(describeError(err).message, 'error')
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-width page-gutter py-8 md:py-10">
      <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">Manage users</h1>

      <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_160px]">
        <input
          type="search"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          placeholder="Search username"
          aria-label="Search by username"
          className={inputClass}
        />
        <input
          type="search"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="Search email (exact)"
          aria-label="Search by email"
          className={inputClass}
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectClass}
        >
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={selectClass}
        >
          <option value="">Any role</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="super admin">Super admin</option>
        </select>
      </div>

      {notice}

      {!notice && (
        <>
          {rows.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No users match those filters"
                body="Try clearing a filter or searching for something else."
              />
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-40">
                    <SortHeader
                      column="username"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    />
                    <SortHeader
                      column="email"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    />
                    <th scope="col" className="py-2 pr-2 text-left font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-2 text-left font-medium">
                      Role
                    </th>
                    <SortHeader
                      column="createdAt"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    />
                    <th scope="col" className="py-2 pl-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="group border-b border-line last:border-0">
                      <td className="py-2.5 pr-2 font-medium text-ink">{u.username}</td>
                      <td className="py-2.5 pr-2 text-ink-70">{u.email}</td>
                      <td className="py-2.5 pr-2">
                        <Badge tone={STATUS_TONES[u.status]}>{STATUS_LABELS[u.status]}</Badge>
                      </td>
                      <td className="py-2.5 pr-2">
                        <Badge tone={ROLE_TONES[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                      </td>
                      <td className="py-2.5 pr-2 text-ink-70">{formatDate(u.createdAt)}</td>
                      <td className="py-2.5 pl-2 text-right">
                        <RowMenu
                          user={u}
                          viewer={viewer}
                          onPick={(action) => setConfirm({ user: u, action })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pager
            metadata={data ? { currPage: data.page, totalPages: data.totalPages } : null}
            onPage={setPage}
          />
        </>
      )}

      {confirm && (
        <ConfirmActionDialog
          user={confirm.user}
          action={confirm.action}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => runAction(confirm.user, confirm.action)}
        />
      )}
    </div>
  )
}
