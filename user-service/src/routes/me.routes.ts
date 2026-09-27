/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the me router (PUT /active-view) as specified in
 *        instructions.md Stage 11.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { Router } from 'express';
import * as meController from '../controllers/me.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.put('/active-view', authenticate, meController.updateActiveView);

export default router;
