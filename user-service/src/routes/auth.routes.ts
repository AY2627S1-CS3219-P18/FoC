// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4a - auth router
// Author review:
// 25/09/2026: Stage 5e - verify-otp and resend-otp routes
// Author review:
// 25/09/2026: Stage 6 pre-work - logout no longer uses authenticate
// Author review:

import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.get('/verify', authController.verify);

export default router;
