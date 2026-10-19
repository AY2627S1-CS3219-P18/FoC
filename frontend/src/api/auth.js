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
  *
 * Tool: Claude Code (model: claude-opus-5), date: 2026-10-19
 * Scope: Repaired session restore. GET /auth/verify was removed from user-service on 2026-10-17, so every reload threw and the user appeared logged out; the id and role now come from the access token's own claims. No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
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
// returns. Resolves null when there is no valid session.
//
// The id and role come from the access token itself. GET /auth/verify, which used to supply them, was
// removed from user-service on 2026-10-17 in favour of JWKS, and every reload had been throwing ever
// since. Neither replacement carries them: GET /users/me returns { username, email } only, and
// POST /auth/refresh returns { accessToken } only. The token is the one thing that has both.
//
// Decoded, not verified. The frontend only needs these for display and routing; each service verifies
// the token itself against user-service's JWKS before trusting anything.
function decodeClaims(token) {
  const payload = token?.split('.')[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    // atob gives bytes, not characters; this is the usual round-trip for non-ASCII claims.
    const text = decodeURIComponent(
      Array.from(json, (ch) => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    )
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function restoreSession() {
  let token
  try {
    token = await refreshAccessToken()
  } catch {
    return null
  }
  const claims = decodeClaims(token)
  if (!claims?.sub) return null
  const profile = await request('/users/me')
  return { id: claims.sub, username: profile.username, email: profile.email, role: claims.role }
}
