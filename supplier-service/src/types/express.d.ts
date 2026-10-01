/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Generated Express Request type augmentation adding req.user ({ user_id, role }) for the
 *        auth middleware. No requirements, architecture, schema, or API decisions were made by the
 *        AI tool.
 * Author review: Congchen
 */
declare global {
  namespace Express {
    interface Request {
      user?: { user_id: string; role: string };
    }
  }
}

export {};
