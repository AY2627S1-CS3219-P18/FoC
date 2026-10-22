/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5), date: 2026-09-08
 * Scope: Generated UI mockup component DemoContext.jsx from team-authored blueprint.md.
 *        Visual/layout implementation only. No requirements, architecture, or
 *        schema decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
  *
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Replaced the demo login flag with a real session (login, logout, silent restore through the refresh cookie) and exposed systemRole/isAdmin. `role` (requester/courier) and the order data stay mocked. No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 *
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope: Order Service frontend integration - opens the order-service Socket.IO connection while
 *        logged in and closes it on logout. The demo request data stays for the screens not yet
 *        connected (chat, demo controls).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 *
 * Tool: Claude Code (model: claude-opus-5), date: 2026-10-22
 * Scope: The credit balance now comes from Credit Service's GET /credits/balance/:userId
 *        instead of the hardcoded figures in src/data/users.js, so the nav pill and the
 *        create-request affordability check show the signed-in user's real credits.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
 * Scope: Per instructions.md Stage 16b and the user's answer to 16a item 2 (full split now),
 *        every real-auth piece (session/login/logout/isAdmin/credits/the order-socket
 *        connection) moved to the new AuthContext. DemoContext shrinks to the demo-only
 *        requester/courier role and the mocked request list; `loginPrompt` is dropped rather
 *        than kept as dead state, since nothing opens a modal anymore (LoginModal deleted).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { requests as seedRequests } from '../data/requests'
import { currentUser } from '../data/users'

const DemoContext = createContext(null)

export function DemoProvider({ children }) {
  const [role, setRole] = useState('requester')
  const [requests, setRequests] = useState(seedRequests)

  // Session-only. Nothing is persisted; a refresh resets the demo.
  const setRequestStatus = useCallback((id, status) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              courierId:
                status === 'open' ? null : r.courierId || (role === 'courier' ? currentUser.id : 'u3'),
              timeline: { ...r.timeline, [status]: new Date().toISOString() },
            }
          : r,
      ),
    )
  }, [role])

  const acceptRequest = useCallback((id) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'accepted',
              courierId: currentUser.id,
              timeline: { ...r.timeline, accepted: new Date().toISOString() },
            }
          : r,
      ),
    )
  }, [])

  const value = useMemo(
    () => ({
      role,
      setRole,
      requests,
      setRequests,
      setRequestStatus,
      acceptRequest,
      currentUser,
    }),
    [role, requests, setRequestStatus, acceptRequest],
  )

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside DemoProvider')
  return ctx
}

// Screenshot mode: ?clean=1 hides the demo controls entirely.
export const isCleanMode = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('clean') === '1'
