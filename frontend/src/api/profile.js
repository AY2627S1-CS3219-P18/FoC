/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
 * Scope: Created the /users/me calls used by AuthContext and the account page (stage 16b of
 *        instructions.md): getProfile (GET /users/me) and setActiveView (PUT
 *        /users/me/active-view). No requirements, architecture, schema, or API decisions were
 *        made by the AI tool.
 * Author review:
 */

import { request } from './http'

// 200 { username, email, activeView }
export async function getProfile() {
  return request('/users/me')
}

// 200, the full user shape: { id, username, email, status, role, activeView, createdAt,
// updatedAt }. Callers only need activeView back; AuthContext keeps the rest of its user object.
export async function setActiveView(activeView) {
  return request('/users/me/active-view', { method: 'PUT', json: { activeView } })
}
