// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4a - auth router
// Author review:

import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', authController.register);

export default router;
