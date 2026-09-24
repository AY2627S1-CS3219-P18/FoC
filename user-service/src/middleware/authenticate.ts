// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4a - Bearer token authentication middleware
// Author review:

import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const { user_id, role } = verifyAccessToken(token);
    req.user = { user_id, role };
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
}
