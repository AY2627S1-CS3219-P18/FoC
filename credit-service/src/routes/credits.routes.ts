// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
//  2026-09-26: Recess iteration - routes for the two operations in scope.
//    Methods and paths are the team's, from credit-service-context.md §8.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review: Wee Jean
//  2026-10-16: Week 7/8 catch-up - transfer, release and balance routes.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review:

import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getBalanceByUserId,
  postAllocate,
  postRelease,
  postTransfer,
  postReserve,
} from '../controllers/credits.controller.js';

const router = Router();

// context §8. /credits/transactions (F19.5.2) and /credits/transactions/all (F20.2)
// remain unbuilt: both need an authenticated caller, which is blocked on the User
// Service public key. See src/middleware/requireBalanceAccess.ts.
router.post('/allocate', asyncHandler(postAllocate));
router.post('/reserve', asyncHandler(postReserve));
router.post('/transfer', asyncHandler(postTransfer));
router.post('/release', asyncHandler(postRelease));

// WARNING: unauthenticated. requireBalanceAccess() implements the F19.5.1 rule but
// cannot be mounted until a token verifier exists, so any caller can read any balance.
// TODO(team): mount requireBalanceAccess(verifier) here once the public key is available.
router.get('/balance/:userId', asyncHandler(getBalanceByUserId));

export default router;
