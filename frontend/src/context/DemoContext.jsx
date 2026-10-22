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
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth'
import { getBalance } from '../api/credits'
import { setOnSessionExpired } from '../api/http'
import { connectOrderSocket, disconnectOrderSocket } from '../realtime/orderSocket'
import { requests as seedRequests } from '../data/requests'
import { currentUser } from '../data/users'

const DemoContext = createContext(null)

/** Logged out, or the balance could not be read. Module-scoped so its identity is stable. */
const NO_CREDITS = { available: 0, reserved: 0, total: 0 }

export function DemoProvider({ children }) {
  // Real session from the User Service: null when logged out. `sessionReady` turns true once the
  // refresh cookie has been tried on page load, so screens do not flash a logged-out state.
  const [session, setSession] = useState(null)
  const [sessionReady, setSessionReady] = useState(false)
  const isLoggedIn = session !== null
  const systemRole = session?.role ?? null
  const isAdmin = systemRole === 'admin' || systemRole === 'super admin'
  const [role, setRole] = useState('requester')
  const [requests, setRequests] = useState(seedRequests)
  const [loginPrompt, setLoginPrompt] = useState(null) // { action: string } | null

  useEffect(() => {
    setOnSessionExpired(() => setSession(null))
    authApi.restoreSession().then(
      (user) => {
        setSession(user)
        setSessionReady(true)
      },
      () => setSessionReady(true),
    )
  }, [])

  // Order events (#6/#59) need a signed-in user: one connection for the whole app.
  useEffect(() => {
    if (!isLoggedIn) return undefined
    connectOrderSocket()
    return () => disconnectOrderSocket()
  }, [isLoggedIn])

  const login = useCallback(async (identifier, password) => {
    setSession(await authApi.login(identifier, password))
    setLoginPrompt(null)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setSession(null)
    }
  }, [])

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

  // Gated actions keep the underlying page visible behind the scrim.
  const requireLogin = useCallback(
    (action, onAllowed) => {
      if (isLoggedIn) {
        onAllowed?.()
        return true
      }
      setLoginPrompt({ action })
      return false
    },
    [isLoggedIn],
  )

  // --- credit balance (F19.5.1) ---------------------------------------------------------
  // Read from Credit Service, not from src/data. Everything that shows a balance reads this:
  // the nav pill and CreateRequest's affordability check, which previously compared an offer
  // against the mockup's hardcoded 14.
  const [credits, setCredits] = useState(NO_CREDITS)

  const userId = session?.id ?? null

  const refreshCredits = useCallback(async () => {
    if (!userId) {
      setCredits(NO_CREDITS)
      return
    }
    try {
      const b = await getBalance(userId)
      setCredits({
        available: b.unreservedBalance,
        reserved: b.reservedBalance,
        total: b.totalBalance,
      })
    } catch {
      // 404 BALANCE_NOT_FOUND (no allocation yet), 503 (identity provider), or a network
      // failure. The nav bar must never take the page down over a balance, so show zero and
      // let the Wallet page, which has proper loading and error states, explain it.
      setCredits(NO_CREDITS)
    }
  }, [userId])

  // Refetch whenever the signed-in user changes, and clear on logout so one user's balance
  // is never briefly visible to the next.
  useEffect(() => {
    if (!sessionReady) return
    void refreshCredits()
  }, [sessionReady, refreshCredits])

  const value = useMemo(
    () => ({
      isLoggedIn,
      session,
      sessionReady,
      systemRole,
      isAdmin,
      login,
      logout,
      role,
      setRole,
      requests,
      setRequests,
      setRequestStatus,
      acceptRequest,
      loginPrompt,
      setLoginPrompt,
      requireLogin,
      currentUser,
      credits,
      refreshCredits,
    }),
    [
      isLoggedIn,
      session,
      sessionReady,
      systemRole,
      isAdmin,
      login,
      logout,
      role,
      requests,
      loginPrompt,
      requireLogin,
      setRequestStatus,
      acceptRequest,
      credits,
      refreshCredits,
    ],
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
