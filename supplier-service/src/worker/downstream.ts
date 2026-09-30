/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Order Service / Message Service ports and logging mock adapters (Phase 4 plan Task 10).
 *        The concrete request contracts are deferred (SupplierServiceArchitecture.md §9 items 5, 17);
 *        the method names and the logging-mock approach are the team's answer of 2026-09-30. No
 *        requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
/** Order Service delete entrypoint (F8.4.2): cancels requests for the supplier not yet collected. */
export interface OrderClient {
  deleteUncollectedRequests(supplierId: number): Promise<void>;
}

/** Message Service notify entrypoint (F8.4.3): notifies affected requesters/couriers. */
export interface MessageClient {
  notifyAffected(supplierId: number): Promise<void>;
}

interface MockOptions {
  /** Force every call to fail, so retries and dead-lettering can be exercised. */
  fail?: boolean;
  log?: (message: string) => void;
}

export function createMockOrderClient({ fail = false, log = console.log }: MockOptions = {}): OrderClient {
  return {
    async deleteUncollectedRequests(supplierId) {
      log(`[mock order-service] delete uncollected requests for supplier ${supplierId}`);
      if (fail) throw new Error('mock order-service failure');
    },
  };
}

export function createMockMessageClient({ fail = false, log = console.log }: MockOptions = {}): MessageClient {
  return {
    async notifyAffected(supplierId) {
      log(`[mock message-service] notify users affected by supplier ${supplierId}`);
      if (fail) throw new Error('mock message-service failure');
    },
  };
}
