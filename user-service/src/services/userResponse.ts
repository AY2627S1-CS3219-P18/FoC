/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
 * Scope: Created toUserResponse, the shared camelCase mapper for user rows, per
 *        instructions.md Stage 15c.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import type { UserRow } from '../db/queries/users.queries.js';

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  status: 'pending' | 'active' | 'suspended';
  role: 'user' | 'admin' | 'super admin';
  activeView: 'requester' | 'courier';
  createdAt: Date;
  updatedAt: Date;
}

// password_hash must never leave the service layer, and DB columns stay snake_case -
// this is the one place that maps a user row to the camelCase shape every response uses.
export function toUserResponse(row: UserRow): UserResponse {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    status: row.status,
    role: row.role,
    activeView: row.active_view,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
