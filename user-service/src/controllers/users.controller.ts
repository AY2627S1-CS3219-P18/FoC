/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the users controllers (list, getById, updateStatus) as specified in
 *        instructions.md Stage 9.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added the changeRole controller as specified in instructions.md Stage 10.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-opus-5), date: 2026-10-19
 * Scope: Added listPublic and getPublicById for the public display-name lookup, so a
 *        non-admin can resolve another user's name. Requested by the user-service owner.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
 * Scope: `list` now validates pagination/search/filter/sort query params, per
 *        instructions.md Stage 15b.
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

// A single, fixed message regardless of why the value failed (wrong type, repeated
// param turned into an array by Express, or not one of `values`) - per instructions.md
// Stage 15b, each query field has exactly one error message.
function enumFilterField<T extends string>(values: readonly T[], message: string) {
  return z.unknown().transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (typeof value === 'string' && (values as readonly string[]).includes(value)) {
      return value as T;
    }
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    return z.NEVER;
  });
}

const pageQuerySchema = z.unknown().transform((value, ctx) => {
  if (value === undefined) return 1;
  if (typeof value === 'string') {
    const page = Number(value);
    if (Number.isInteger(page) && page >= 1) return page;
  }
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Page must be a positive integer' });
  return z.NEVER;
});

// Empty string (e.g. `?username=`) is treated as the param being absent.
const usernameQuerySchema = z.unknown().transform((value, ctx) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Username must be a string' });
    return z.NEVER;
  }
  return value === '' ? undefined : value.toLowerCase();
});

const emailQuerySchema = z.unknown().transform((value, ctx) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Email must be a string' });
    return z.NEVER;
  }
  return value === '' ? undefined : value.trim().toLowerCase();
});

const listUsersQuerySchema = z
  .object({
    page: pageQuerySchema,
    username: usernameQuerySchema,
    email: emailQuerySchema,
    status: enumFilterField(
      ['pending', 'active', 'suspended'] as const,
      "Status must be 'pending', 'active' or 'suspended'",
    ),
    role: enumFilterField(
      ['user', 'admin', 'super admin'] as const,
      "Role must be 'user', 'admin' or 'super admin'",
    ),
    sortBy: enumFilterField(
      ['username', 'email', 'createdAt'] as const,
      "sortBy must be 'username', 'email' or 'createdAt'",
    ),
    sortDir: enumFilterField(['asc', 'desc'] as const, "sortDir must be 'asc' or 'desc'"),
  })
  .strict();

// A page of transaction references is 20 ids; 50 leaves headroom without letting a
// caller ask for the whole table one query string at a time.
const MAX_PUBLIC_IDS = 50;

const publicIdsSchema = z.object({
  ids: z
    .string({ required_error: 'ids is required' })
    .transform((value) => value.split(',').map((id) => id.trim()).filter(Boolean))
    .pipe(
      z
        .array(z.string().uuid('Invalid user ID'))
        .min(1, 'ids must contain at least one user ID')
        .max(MAX_PUBLIC_IDS, `ids must contain at most ${MAX_PUBLIC_IDS} user IDs`),
    ),
});

// GET /users/public?ids=<uuid>,<uuid>
// Any authenticated caller. Returns id and username only; ids that match nothing are
// omitted rather than raising.
export const listPublic = asyncHandler(async (req, res) => {
  const { ids } = publicIdsSchema.parse(req.query);
  const users = await usersService.listPublicUsers(ids);
  res.status(200).json({ users });
});

// GET /users/public/:id — the single-id form of the above.
export const getPublicById = asyncHandler(async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const user = await usersService.getPublicUserById(id);
  res.status(200).json(user);
});

export const list = asyncHandler(async (req, res) => {
  const parsed = listUsersQuerySchema.parse(req.query);
  const sortBy = parsed.sortBy ?? 'createdAt';
  const sortDir = parsed.sortDir ?? (sortBy === 'createdAt' ? 'desc' : 'asc');

  const result = await usersService.listUsers({
    page: parsed.page,
    username: parsed.username,
    email: parsed.email,
    status: parsed.status,
    role: parsed.role,
    sortBy,
    sortDir,
  });
  res.status(200).json(result);
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

const roleErrorMap: z.ZodErrorMap = (issue) => {
  if (issue.code === 'invalid_enum_value') {
    return { message: "Role must be 'admin' or 'user'" };
  }
  if (issue.code === 'invalid_type' && issue.received === 'undefined') {
    return { message: 'Role is required' };
  }
  return { message: 'Role must be a string' };
};

const changeRoleSchema = z
  .object({ role: z.enum(['admin', 'user'], { errorMap: roleErrorMap }) })
  .strict();

export const changeRole = asyncHandler(async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const { role } = changeRoleSchema.parse(req.body);
  // authenticate has run, so req.user is set.
  const user = await usersService.changeUserRole(req.user!.user_id, id, role);
  res.status(200).json(user);
});
