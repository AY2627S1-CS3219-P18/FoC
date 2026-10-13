import { randomUUID } from 'node:crypto';

/*
 * AI Assistance Disclosure:
 * Tool: GitHub Copilot SDK in VS Code (model: GPT-5.6 Luna), date: 2026-10-13
 * Scope: Extended credit reservation input to carry the order identifier.
 * No requirements, architecture, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */

export type ReserveResult =
  | { ok: true; reservationId: string }
  | { ok: false; reason: 'INSUFFICIENT_CREDITS' | 'UNAVAILABLE' };

export interface CreditsClient {
  reserve(input: {
    requesterId: string;
    requestId: string;
    amount: number;
  }): Promise<ReserveResult>;

  release(reservationId: string): Promise<void>;
}

export function createStubCreditsClient(): CreditsClient {
  return {
    async reserve() {
      return { ok: true, reservationId: `stub-${randomUUID()}` };
    },
    async release() {},
  };
}
