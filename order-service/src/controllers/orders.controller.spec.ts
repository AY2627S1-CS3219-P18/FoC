/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-09-27
 * Scope: HTTP-level tests for POST /orders status codes.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: george-yeo
 */

import request from 'supertest';
import { createApp } from '../app.js';
import type {
  CreditsClient,
  ReserveResult,
} from '../clients/credits.client.js';
import type { PrismaClient } from '../db/prisma.js';

const USER = '0192f0c4-7a1e-7c3a-9b2d-3f4e5a6b7c8d';
const body = {
  supplierId: '0192f0c4-7a1e-7c3a-9b2d-000000000001',
  description: '1x chicken rice',
  deliveryLocation: 'COM1 Basement',
  credits: 4,
};

function appWith(reserve: () => Promise<ReserveResult>) {
  const prisma = {
    orderRequest: {
      create: async ({ data }: { data: object }) => ({ id: 'new', ...data }),
    },
  } as unknown as PrismaClient;
  const credits: CreditsClient = { reserve, release: async () => {} };
  return createApp({ prisma, credits });
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('POST /orders', () => {
  it('201 with the created request when credits are reserved', async () => {
    const res = await request(
      appWith(async () => ({ ok: true, reservationId: 'r' })),
    )
      .post('/orders')
      .set('x-user-id', USER)
      .send(body)
      .expect(201);
    expect(res.body).toMatchObject({ id: 'new', credits: 4 });
  });

  it('422 when the requester does not have enough credits', async () => {
    await request(
      appWith(async () => ({ ok: false, reason: 'INSUFFICIENT_CREDITS' })),
    )
      .post('/orders')
      .set('x-user-id', USER)
      .send(body)
      .expect(422, {
        message: 'You do not have enough credits for this request.',
      });
  });

  it('503 when credit-service is unavailable', async () => {
    await request(appWith(async () => ({ ok: false, reason: 'UNAVAILABLE' })))
      .post('/orders')
      .set('x-user-id', USER)
      .send(body)
      .expect(503);
  });

  it('400 when complete-by is in the past', async () => {
    await request(appWith(async () => ({ ok: true, reservationId: 'r' })))
      .post('/orders')
      .set('x-user-id', USER)
      .send({ ...body, completeBy: '2000-01-01T00:00:00.000Z' })
      .expect(400, { message: 'Complete-by time must be in the future.' });
  });
});
