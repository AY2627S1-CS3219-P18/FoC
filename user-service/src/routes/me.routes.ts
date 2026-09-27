/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the me router (PUT /active-view) as specified in
 *        instructions.md Stage 11.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added GET / as specified in instructions.md Stage 12a.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added PUT /username as specified in instructions.md Stage 12b.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added PUT /email as specified in instructions.md Stage 12c.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added POST /verify-otp and POST /resend-otp as specified in instructions.md Stage 12d.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { Router } from 'express';
import * as meController from '../controllers/me.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/', authenticate, meController.getProfile);
router.put('/active-view', authenticate, meController.updateActiveView);
router.put('/username', authenticate, meController.changeUsername);
router.put('/email', authenticate, meController.changeEmail);
router.post('/verify-otp', authenticate, meController.verifyOtp);
router.post('/resend-otp', authenticate, meController.resendOtp);

export default router;
