/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-23
 * Scope (2026-10-23): Unit tests for the supplier-service client - status mapping
 *        (200 found, 404 not_found, anything else / network / timeout unavailable), location
 *        membership, and the caller's token forwarded.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { createHttpSuppliersClient } from './suppliers.client.js';

const BASE = 'http://supplier-service:3002';
const AUTH = 'Bearer abc';

const respond = (status: number, body: unknown = {}) =>
  vi.fn(
    async (_url: URL | RequestInfo, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );

describe('createHttpSuppliersClient', () => {
  it('GETs /api/v1/suppliers/:id with the caller token', async () => {
    const fetchImpl = respond(200, { supplier_id: 7 });
    const client = createHttpSuppliersClient(BASE, fetchImpl);
    await expect(client.supplierExists(7, AUTH)).resolves.toBe('found');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect((url as URL).href).toBe(`${BASE}/api/v1/suppliers/7`);
    expect(init?.headers).toMatchObject({ authorization: AUTH });
  });

  it.each([
    [404, 'not_found'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [429, 'unavailable'],
    [401, 'unavailable'],
    [403, 'unavailable'],
  ] as const)('supplier: HTTP %i -> %s', async (status, expected) => {
    const client = createHttpSuppliersClient(BASE, respond(status));
    await expect(client.supplierExists(7, AUTH)).resolves.toBe(expected);
  });

  it('network failure -> unavailable', async () => {
    const client = createHttpSuppliersClient(
      BASE,
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(client.supplierExists(7, AUTH)).resolves.toBe('unavailable');
    await expect(client.locationExists(1, AUTH)).resolves.toBe('unavailable');
  });

  it('a hung supplier-service times out -> unavailable', async () => {
    const hang = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        }),
    );
    const client = createHttpSuppliersClient(BASE, hang as typeof fetch, 20);
    await expect(client.supplierExists(7, AUTH)).resolves.toBe('unavailable');
  });

  it('location: membership in /reference/location', async () => {
    const fetchImpl = respond(200, {
      locations: [{ location_id: 1 }, { location_id: 12 }],
    });
    const client = createHttpSuppliersClient(BASE, fetchImpl);
    await expect(client.locationExists(12, AUTH)).resolves.toBe('found');
    await expect(client.locationExists(13, AUTH)).resolves.toBe('not_found');
    expect((fetchImpl.mock.calls[0]![0] as URL).href).toBe(
      `${BASE}/api/v1/suppliers/reference/location`,
    );
  });

  it.each([
    ['a 500', respond(500)],
    ['an unexpected body', respond(200, { nope: true })],
  ])('location: %s -> unavailable', async (_name, fetchImpl) => {
    const client = createHttpSuppliersClient(BASE, fetchImpl);
    await expect(client.locationExists(12, AUTH)).resolves.toBe('unavailable');
  });
});
