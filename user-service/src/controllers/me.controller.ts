/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the me controller (updateActiveView) as specified in
 *        instructions.md Stage 11.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added getProfile as specified in instructions.md Stage 12a.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { z } from 'zod';
import * as meService from '../services/me.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const activeViewErrorMap: z.ZodErrorMap = (issue) => {
  if (issue.code === 'invalid_enum_value') {
    return { message: "Active view must be 'requester' or 'courier'" };
  }
  if (issue.code === 'invalid_type' && issue.received === 'undefined') {
    return { message: 'Active view is required' };
  }
  return { message: 'Active view must be a string' };
};

const updateActiveViewSchema = z
  .object({ activeView: z.enum(['requester', 'courier'], { errorMap: activeViewErrorMap }) })
  .strict();

export const updateActiveView = asyncHandler(async (req, res) => {
  const { activeView } = updateActiveViewSchema.parse(req.body);
  // authenticate has run, so req.user is set. The id never comes from the body.
  const user = await meService.changeActiveView(req.user!.user_id, activeView);
  res.status(200).json(user);
});

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await meService.getOwnProfile(req.user!.user_id);
  res.status(200).json(profile);
});
