/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Generated the users router (GET /, GET /:id, PUT /:id/status) as specified in
 *        instructions.md Stage 9.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-27
 * Scope: Added PUT /:id/role as specified in instructions.md Stage 10.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 *
 * Tool: Claude Code (model: claude-opus-5), date: 2026-10-19
 * Scope: Added GET /public and GET /public/:id, the public display-name lookup.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { Router } from 'express';
import * as usersController from '../controllers/users.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

// Must precede GET /:id, or ':id' captures the literal "public" and fails UUID validation.
// authenticate only: any signed-in user may resolve a display name, no role required.
router.get('/public', authenticate, usersController.listPublic);
router.get('/public/:id', authenticate, usersController.getPublicById);

router.get('/', authenticate, authorize('admin'), usersController.list);
router.get('/:id', authenticate, authorize('admin'), usersController.getById);
router.put('/:id/status', authenticate, authorize('admin'), usersController.updateStatus);
router.put('/:id/role', authenticate, authorize('super admin'), usersController.changeRole);

export default router;
