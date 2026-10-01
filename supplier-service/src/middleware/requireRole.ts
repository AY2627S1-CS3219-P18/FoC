/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Generated the role-guard middleware implementing the per-endpoint role column from
 *        SupplierServiceArchitecture.md §7 (user, admin, super admin). No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

export function requireRole(...allowedRoles: string[]) {
  return function roleGuard(req: Request, _res: Response, next: NextFunction): void {
    if (req.user === undefined || !allowedRoles.includes(req.user.role)) {
      next(new AppError(403, 'Forbidden', 'You do not have permission to perform this operation.'));
      return;
    }
    next();
  };
}
