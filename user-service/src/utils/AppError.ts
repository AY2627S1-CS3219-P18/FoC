// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4a - AppError class
// Author review:

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
