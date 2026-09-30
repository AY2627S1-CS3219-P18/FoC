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
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth'
import { setOnSessionExpired } from '../api/http'
import { requests as seedRequests } from '../data/requests'
import { currentUser } from '../data/users'

const DemoContext = createContext(null)

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

  // Balance figures come straight from users.js so every screen shows the same
  // 14 available / 6 reserved / 20 total the blueprint specifies.
  const credits = useMemo(
    () => ({
      available: currentUser.creditsAvailable,
      reserved: currentUser.creditsReserved,
      total: currentUser.creditsAvailable + currentUser.creditsReserved,
    }),
    [],
  )

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
