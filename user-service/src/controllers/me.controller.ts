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
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added changeUsername as specified in instructions.md Stage 12b.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added changeEmail as specified in instructions.md Stage 12c.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { z } from 'zod';
import { emailField } from './auth.controller.js';
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

// Lowercased only, not trimmed — same normalisation as registration's username field,
// but with this endpoint's own required/type messages.
const newUsernameField = z
  .string({
    required_error: 'New username is required',
    invalid_type_error: 'New username must be a string',
  })
  .toLowerCase();

const changeUsernameSchema = z.object({ newUsername: newUsernameField }).strict();

export const changeUsername = asyncHandler(async (req, res) => {
  const { newUsername } = changeUsernameSchema.parse(req.body);
  const profile = await meService.changeUsername(req.user!.user_id, newUsername);
  res.status(200).json(profile);
});

const changeEmailSchema = z
  .object({
    currentPassword: z.string({
      required_error: 'Current password is required',
      invalid_type_error: 'Current password must be a string',
    }),
    newEmail: emailField,
  })
  .strict();

export const changeEmail = asyncHandler(async (req, res) => {
  const { currentPassword, newEmail } = changeEmailSchema.parse(req.body);
  await meService.initiateEmailChange(req.user!.user_id, { currentPassword, newEmail });
  res
    .status(200)
    .json({ message: 'Verification code sent to your new email', code: 'OTP_SENT' });
});
