// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
//  2026-09-26: Recess iteration - request validation and response shaping for
//    POST /credits/allocate and POST /credits/reserve.
//    The request and response bodies here are NOT team-decided. context §8 fixes only
//    the method and path; the field names, validation rules and status codes are
//    pending sign-off - see credit-service/README.md.
//    Author review: Wee Jean

import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { allocateInitialCredits, reserveCredits } from '../services/credits.service.js';

// user_id and request_id are UUIDs owned by User Service and Order Service (context §3).
const allocateSchema = z.object({
  userId: z.string().uuid(),
});

const reserveSchema = z.object({
  userId: z.string().uuid(),
  requestId: z.string().uuid(),
  // Credits are whole and positive; the balance CHECK constraints assume it.
  amount: z.number().int().positive(),
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    throw new AppError(400, details, 'INVALID_REQUEST_BODY');
  }
  return result.data;
}

/** POST /credits/allocate — F19.1.1 */
export async function postAllocate(req: Request, res: Response): Promise<void> {
  const { userId } = parseBody(allocateSchema, req.body);
  const result = await allocateInitialCredits(userId);
  res.status(201).json(result);
}

/** POST /credits/reserve — F19.2.1, F19.2.3 */
export async function postReserve(req: Request, res: Response): Promise<void> {
  const { userId, requestId, amount } = parseBody(reserveSchema, req.body);
  const result = await reserveCredits(userId, requestId, amount);
  res.status(201).json(result);
}
