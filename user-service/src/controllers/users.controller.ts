/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the users controllers (list, getById, updateStatus) as specified in
 *        instructions.md Stage 9.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { z } from 'zod';
import * as usersService from '../services/users.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// A failed .uuid() check is a ZodError, which the global error handler turns into
// 400 VALIDATION_ERROR with this message, before any DB call.
const idParamsSchema = z.object({ id: z.string().uuid('Invalid user ID') });

const statusErrorMap: z.ZodErrorMap = (issue) => {
  if (issue.code === 'invalid_enum_value') {
    return { message: "Status must be 'active' or 'suspended'" };
  }
  if (issue.code === 'invalid_type' && issue.received === 'undefined') {
    return { message: 'Status is required' };
  }
  return { message: 'Status must be a string' };
};

const updateStatusSchema = z
  .object({ status: z.enum(['active', 'suspended'], { errorMap: statusErrorMap }) })
  .strict();

export const list = asyncHandler(async (_req, res) => {
  const users = await usersService.listUsers();
  res.status(200).json({ users });
});

export const getById = asyncHandler(async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const user = await usersService.getUserById(id);
  res.status(200).json(user);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const { status } = updateStatusSchema.parse(req.body);
  // authenticate has run, so req.user is set.
  const user = await usersService.changeUserStatus(req.user!.role, id, status);
  res.status(200).json(user);
});
