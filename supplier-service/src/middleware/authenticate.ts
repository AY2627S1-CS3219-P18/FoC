/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Generated auth middleware that verifies the bearer token by calling the User Service's
 *        GET /auth/verify (SupplierServiceArchitecture.md §7 intro) and attaches { user_id, role }
 *        to req.user; missing/non-Bearer header, non-2xx from verify, or malformed body -> 401
 *        (§7.1); unreachable User Service -> 500 (§7.1 unhandled failure row). No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { AppError } from '../utils/AppError.js';

function unauthorized(): AppError {
  return new AppError(401, 'Unauthorized', 'Bearer token is missing or invalid.');
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(unauthorized());
    return;
  }

  let verifyResponse: Awaited<ReturnType<typeof fetch>>;
  try {
    verifyResponse = await fetch(`${config.userServiceUrl}/auth/verify`, {
      headers: { Authorization: authHeader },
    });
  } catch {
    next(new AppError(500, 'Internal Server Error', 'Failed to reach the User Service.'));
    return;
  }

  if (!verifyResponse.ok) {
    next(unauthorized());
    return;
  }

  try {
    const identity = (await verifyResponse.json()) as { user_id?: unknown; role?: unknown };
    if (typeof identity.user_id !== 'string' || typeof identity.role !== 'string') {
      next(unauthorized());
      return;
    }
    req.user = { user_id: identity.user_id, role: identity.role };
    next();
  } catch {
    next(unauthorized());
  }
}
