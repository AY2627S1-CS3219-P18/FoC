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
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
 * Scope: restoreSession now also reads activeView from GET /users/me (via the new
 *        src/api/profile.js), for AuthContext (instructions.md Stage 16b). The JWT-decode
 *        helper moved to http.js as decodeAccessTokenClaims, so http.js can reuse it for
 *        proactive refresh scheduling without a circular import.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-23
 * Scope: Added register, verifyOtp and resendOtp, the calls Register.jsx needs, per
 *        instructions.md Stage 16c (POST /auth/register, /auth/verify-otp, /auth/resend-otp).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { decodeAccessTokenClaims, refreshAccessToken, request, setAccessToken } from './http'
import { getProfile } from './profile'

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

// 201 { message, code: 'OTP_SENT' }. 400 VALIDATION_ERROR, 409 USERNAME_TAKEN / EMAIL_TAKEN.
export async function register({ username, email, password }) {
  return request('/auth/register', { method: 'POST', json: { username, email, password } })
}

// 200 { message, code }. 400 INVALID_OTP / OTP_EXPIRED / OTP_ATTEMPTS_EXCEEDED.
export async function verifyOtp({ email, otp, purpose }) {
  return request('/auth/verify-otp', { method: 'POST', json: { email, otp, purpose } })
}

// 200 { message, code: 'OTP_SENT' }. 404 NO_PENDING_REGISTRATION, 429 OTP_RESEND_COOLDOWN /
// OTP_RESEND_LIMIT (with Retry-After on cooldown).
export async function resendOtp({ email, purpose }) {
  return request('/auth/resend-otp', { method: 'POST', json: { email, purpose } })
}

// Page load: trade the refresh cookie for an access token, then rebuild the same user object login
// returns. Resolves null when there is no valid session.
//
// The id and role come from the access token itself. GET /auth/verify, which used to supply them, was
// removed from user-service on 2026-10-17 in favour of JWKS, and every reload had been throwing ever
// since. Neither replacement carries them: GET /users/me returns { username, email, activeView } only,
// and POST /auth/refresh returns { accessToken } only. The token is the one thing that has both.
export async function restoreSession() {
  let token
  try {
    token = await refreshAccessToken()
  } catch {
    return null
  }
  const claims = decodeAccessTokenClaims(token)
  if (!claims?.sub) return null
  const profile = await getProfile()
  return {
    id: claims.sub,
    username: profile.username,
    email: profile.email,
    role: claims.role,
    activeView: profile.activeView,
  }
}
