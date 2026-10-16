// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-10-16
//  2026-10-16: Week 7/8 catch-up - the authorization seam for F19.5.1. Written but NOT
//    mounted; see the BLOCKED note below.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review:

import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import { canReadBalance, type AuthenticatedUser } from '../auth/roleRank.js';

/**
 * Verifies a bearer token and returns who is calling.
 *
 * ──────────────────────────── BLOCKED ────────────────────────────
 * TODO(team): no implementation can be written yet. User Service signs access tokens
 * with RS256 (user-service/src/utils/jwt.ts), so Credit Service needs its PUBLIC KEY to
 * verify them locally. That key lives in user-service/keys/, which is git-ignored and
 * absent from the repository, and no mechanism exists to distribute it to this service.
 *
 * Blocked on BOTH of:
 *   1. the public key reaching this service (a mounted file, a secret, or a JWKS URL);
 *   2. the team choosing between local RS256 verification and calling
 *      GET /auth/verify on User Service per request (context §3, open question 1).
 *
 * Deliberately NOT worked around. A hardcoded key, or a path that decodes the token
 * without verifying it, would look like authentication while providing none.
 * ─────────────────────────────────────────────────────────────────
 */
export type TokenVerifier = (bearerToken: string) => AuthenticatedUser;

/**
 * F19.5.1 - a user may read only their own balance unless elevated.
 *
 * Takes the verifier as a parameter so the route can be wired the moment the key
 * problem above is solved, without this file changing.
 *
 * NOT CURRENTLY MOUNTED. credits.routes.ts serves GET /credits/balance/:userId with no
 * authentication at all, because there is no verifier to pass in. Until that changes,
 * any caller can read any balance. This is recorded in API.md and README.md.
 */
export function requireBalanceAccess(verify: TokenVerifier) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next(new AppError(401, 'Authentication required.', 'UNAUTHORIZED'));
      return;
    }

    let viewer: AuthenticatedUser;
    try {
      viewer = verify(header.slice('Bearer '.length));
    } catch {
      next(new AppError(401, 'Authentication required.', 'UNAUTHORIZED'));
      return;
    }

    const targetUserId = req.params.userId;
    if (!targetUserId || !canReadBalance(viewer, targetUserId)) {
      next(new AppError(403, 'You may not read this balance.', 'FORBIDDEN'));
      return;
    }

    next();
  };
}
