/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Created the User Service calls the frontend makes (login, logout, session restore), following
 *        the endpoints in user-service/src/routes (POST /auth/login, /auth/logout, /auth/refresh,
 *        GET /users/me). No requirements, architecture, schema, or API decisions were made by the AI
 *        tool.
 * Author review: Congchen
  *
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Session restore now reads the role from GET /auth/verify, because GET /users/me does not return it (a reload had made admins look like ordinary users). No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 */

import { refreshAccessToken, request, setAccessToken } from './http'

// 200 { accessToken, user: { id, username, email, role, activeView } }; the refresh cookie is set by the
// service. 401 INVALID_CREDENTIALS, 403 ACCOUNT_SUSPENDED / ACCOUNT_NOT_VERIFIED.
export async function login(identifier, password) {
  const { accessToken, user } = await request('/auth/login', {
    method: 'POST',
    json: { identifier, password },
  })
  setAccessToken(accessToken)
  return user
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' })
  } finally {
    setAccessToken(null)
  }
}

// Page load: trade the refresh cookie for an access token, then rebuild the same user object login
// returns. GET /users/me gives username and email but no role, so the role comes from GET /auth/verify
// ({ user_id, role }). Resolves null when there is no valid session.
export async function restoreSession() {
  try {
    await refreshAccessToken()
  } catch {
    return null
  }
  const [profile, identity] = await Promise.all([request('/users/me'), request('/auth/verify')])
  return { id: identity.user_id, username: profile.username, email: profile.email, role: identity.role }
}
