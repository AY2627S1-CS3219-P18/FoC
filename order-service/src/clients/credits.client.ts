import { randomUUID } from 'node:crypto';

export type ReserveResult =
  | { ok: true; reservationId: string }
  | { ok: false; reason: 'INSUFFICIENT_CREDITS' | 'UNAVAILABLE' };

export interface CreditsClient {
  reserve(input: {
    requesterId: string;
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
