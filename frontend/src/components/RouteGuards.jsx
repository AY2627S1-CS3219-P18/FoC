/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
 * Scope: Created RequireAuth and RequireRole, per instructions.md Stage 16b. While the session
 *        is still restoring, both render nothing rather than redirect, so a logged-in user on
 *        reload never flashes a login page. The role rank order mirrors the backend's
 *        authorize middleware (user-service/src/middleware/authorize.ts: user < admin <
 *        super admin).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-05
 * Scope: Added ViewGate, per instructions.md Stage 22's "Opening another view's page" and
 *        "Toggling the view" rows. It reads user.activeView straight from AuthContext on every
 *        render, so toggling the view elsewhere (the nav's ActiveViewToggle) re-renders any
 *        mounted ViewGate automatically, including the toast-and-revert case on a failed
 *        toggle - no extra wiring between the two. Rendered inside RequireAuth (App.jsx), so
 *        user is never null here; the guard is defensive only.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Forbidden from './Forbidden'
import EmptyState from './EmptyState'
import Button from './Button'
import { NAV_LINKS, VIEW_MODE_LABEL, mainPageFor } from '../routing/views'

// Same rank order as user-service/src/middleware/authorize.ts's ROLE_RANK.
const ROLE_RANK = { user: 0, admin: 1, 'super admin': 2 }

export function RequireAuth({ children }) {
  const { status, isLoggedIn } = useAuth()
  const location = useLocation()

  if (status === 'loading') return null
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

export function RequireRole({ minimum, children }) {
  const { status, isLoggedIn, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return null
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />
  if (ROLE_RANK[user.role] < ROLE_RANK[minimum]) return <Forbidden />
  return children
}

// Shown in place when a requester-only or courier-only page is opened from the other view: the
// URL does not change. Two actions: switch to the page's view (it then renders normally), or go
// to the current view's main page without changing the view.
export function ViewGate({ requiredView, children }) {
  const { user, setActiveView } = useAuth()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState(null)

  if (!user || user.activeView === requiredView) return children

  const switchView = async () => {
    setSwitching(true)
    setSwitchError(null)
    try {
      await setActiveView(requiredView)
    } catch {
      setSwitchError('Could not switch views. Try again.')
    } finally {
      setSwitching(false)
    }
  }

  const requiredLabel = NAV_LINKS[requiredView][0].label
  const currentLabel = NAV_LINKS[user.activeView][0].label

  return (
    <div className="page-width page-gutter py-10">
      <EmptyState
        title={'This is only available in ' + VIEW_MODE_LABEL[requiredView]}
        body={switchError}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" disabled={switching} onClick={switchView}>
              {switching ? 'Switching…' : 'Switch to ' + requiredLabel}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(mainPageFor(user.activeView))}
            >
              Go to {currentLabel}
            </Button>
          </div>
        }
      />
    </div>
  )
}
