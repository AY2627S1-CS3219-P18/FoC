/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-23
 * Scope: Created the admin user-management calls used by AdminUsers.jsx, per instructions.md
 *        Stage 16g: listUsers (GET /users, paginated/searchable/filterable/sortable per the
 *        user-service's Stage 15b), updateUserStatus (PUT /users/:id/status) and
 *        updateUserRole (PUT /users/:id/role).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { request } from './http'

// 200 { users, page, pageSize, total, totalPages }. users.js's shape mirrors profile.js's
// getProfile: { id, username, email, status, role, activeView, createdAt, updatedAt }.
// Admin/super admin only (403 FORBIDDEN otherwise).
export async function listUsers({ page, username, email, status, role, sortBy, sortDir }) {
  return request('/users', { query: { page, username, email, status, role, sortBy, sortDir } })
}

// 200 the full user shape. 404 USER_NOT_FOUND, 403 SUPER_ADMIN_IMMUTABLE / FORBIDDEN (an admin
// targeting another admin), 422 CANNOT_CHANGE_STATUS_PENDING_USER.
export async function updateUserStatus(id, status) {
  return request('/users/' + id + '/status', { method: 'PUT', json: { status } })
}

// 200 the full user shape. super admin only (403 FORBIDDEN otherwise). 404 USER_NOT_FOUND, 403
// SUPER_ADMIN_IMMUTABLE / SELF_ROLE_CHANGE, 422 CANNOT_CHANGE_ROLE_PENDING_USER /
// CANNOT_CHANGE_ROLE_SUSPENDED_USER.
export async function updateUserRole(id, role) {
  return request('/users/' + id + '/role', { method: 'PUT', json: { role } })
}
