/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Validation for the list query parameters and :id path parameter listed in
 *        SupplierServiceArchitecture.md §7.2, mapping failures to the 422 error envelope from §7.1 /
 *        §7.1.1. The open questions on `limit`, defaults and edges are recorded in the Phase 1 plan.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-09-29, Claude Code, model: claude-sonnet-5): allowed 'body' as a parseOrThrow location per Phase 2 plan
 *        Task 4. No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

export const PAGE_SIZE = 50;

const positiveInt = z.coerce.number().int().positive();

export const listQuerySchema = z.object({
  page: positiveInt.default(1),
  limit: z.coerce
    .number()
    .int()
    .refine((value) => value === PAGE_SIZE, { message: `limit is fixed at ${PAGE_SIZE}` })
    .optional(),
  search: z.string().trim().optional(),
  location_id: positiveInt.optional(),
  category_id: positiveInt.optional(),
  isOpen: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  sortOrder: z.enum(['A-Z', 'Z-A']).default('A-Z'),
});

export const idParamSchema = z.object({ id: positiveInt });

export function parseOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
  location: 'query' | 'path' | 'body',
): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  throw new AppError(422, 'Unprocessable Entity', 'One or more request values failed validation.', {
    details: result.error.issues.map((issue) => ({
      field: issue.path.join('.') || location,
      location,
      message: issue.message,
    })),
  });
}
