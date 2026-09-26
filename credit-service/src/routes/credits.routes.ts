// AI Assistance Disclosure:
// Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
//  2026-09-26: Recess iteration - routes for the two operations in scope.
//    Methods and paths are the team's, from credit-service-context.md §8.
//    No requirements, architecture, schema, or API decisions were made by the AI tool.
//    Author review:

import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { postAllocate, postReserve } from '../controllers/credits.controller.js';

const router = Router();

// context §8. The remaining routes in that table - /credits/transfer (week 7),
// /credits/release (week 8), /credits/balance/:userId and /credits/transactions
// (week 8), /credits/transactions/all (week 9) - are deliberately absent: they are
// later iterations and are not stubbed.
router.post('/allocate', asyncHandler(postAllocate));
router.post('/reserve', asyncHandler(postReserve));

export default router;
