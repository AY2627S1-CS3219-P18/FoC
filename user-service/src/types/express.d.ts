// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4a - Express Request augmentation
// Author review:

declare global {
  namespace Express {
    interface Request {
      user?: { user_id: string; role: string };
    }
  }
}

export {};
