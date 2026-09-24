// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4a - AppError class
// Author review:
// 25/09/2026: Stage 5e - optional retryAfterSeconds
// Author review:

export class AppError extends Error {
  status: number;
  code: string;
  retryAfterSeconds?: number;

  constructor(status: number, message: string, code: string, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.code = code;
    if (retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
}
