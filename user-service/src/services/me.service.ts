/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the me service (changeActiveView) as specified in
 *        instructions.md Stage 11.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added getOwnProfile as specified in instructions.md Stage 12a.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import * as userQueries from '../db/queries/users.queries.js';
import { AppError } from '../utils/AppError.js';
import { toPublicUser, type PublicUser } from './users.service.js';

// A plain single-row UPDATE: no lock or transaction, since there is no transition rule and no
// side effect to keep atomic with the write.
export async function changeActiveView(
  userId: string,
  activeView: 'requester' | 'courier',
): Promise<PublicUser> {
  const row = await userQueries.updateActiveView(userId, activeView);
  if (!row) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }
  return toPublicUser(row);
}

export async function getOwnProfile(
  userId: string,
): Promise<{ username: string; email: string }> {
  const user = await userQueries.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }
  return { username: user.username, email: user.email };
}
