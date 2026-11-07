/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-23
 * Scope (2026-10-23): Existence checks for create/edit (George, 2026-10-23: call
 *        supplier-service synchronously with the caller's token; outage = 503). Supplier via
 *        GET /api/v1/suppliers/:id (inactive or deleted suppliers are 404 there); location
 *        via membership in GET /api/v1/suppliers/reference/location. The 3 s timeout is by
 *        convention and flagged for review.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

/** `unavailable`: supplier-service could not answer (down, timeout, 5xx, 429, auth). */
export type Existence = 'found' | 'not_found' | 'unavailable';

export interface SuppliersClient {
  /** `authorization` is the caller's own `Bearer …` header, passed through. */
  supplierExists(supplierId: number, authorization: string): Promise<Existence>;
  locationExists(locationId: number, authorization: string): Promise<Existence>;
}

type FetchLike = typeof fetch;

export const SUPPLIER_CALL_TIMEOUT_MS = 3_000;

export function createHttpSuppliersClient(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs: number = SUPPLIER_CALL_TIMEOUT_MS,
): SuppliersClient {
  async function get(path: string, authorization: string) {
    try {
      return await fetchImpl(new URL(path, baseUrl), {
        headers: { authorization, accept: 'application/json' },
        // In the request path, so bounded: a hung supplier-service must not hang POST /orders.
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return null; // refused / reset / DNS / timeout
    }
  }

  return {
    async supplierExists(supplierId, authorization) {
      const res = await get(`/api/v1/suppliers/${supplierId}`, authorization);
      if (!res) return 'unavailable';
      if (res.ok) return 'found';
      return res.status === 404 ? 'not_found' : 'unavailable';
    },

    async locationExists(locationId, authorization) {
      const res = await get(
        '/api/v1/suppliers/reference/location',
        authorization,
      );
      if (!res?.ok) return 'unavailable';
      try {
        const body = (await res.json()) as {
          locations?: { location_id?: unknown }[];
        };
        if (!Array.isArray(body?.locations)) return 'unavailable';
        return body.locations.some((l) => l?.location_id === locationId)
          ? 'found'
          : 'not_found';
      } catch {
        return 'unavailable'; // not the expected JSON
      }
    },
  };
}

/** Unit tests only: every id exists. */
export function createStubSuppliersClient(): SuppliersClient {
  return {
    async supplierExists() {
      return 'found';
    },
    async locationExists() {
      return 'found';
    },
  };
}
