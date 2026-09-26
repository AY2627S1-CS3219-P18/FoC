/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the users router (GET /, GET /:id, PUT /:id/status) as specified in
 *        instructions.md Stage 9.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { Router } from 'express';
import * as usersController from '../controllers/users.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.get('/', authenticate, authorize('admin'), usersController.list);
router.get('/:id', authenticate, authorize('admin'), usersController.getById);
router.put('/:id/status', authenticate, authorize('admin'), usersController.updateStatus);

export default router;
