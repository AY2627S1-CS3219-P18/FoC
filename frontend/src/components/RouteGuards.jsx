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
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Forbidden from './Forbidden'

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
