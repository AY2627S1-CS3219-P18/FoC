/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope: Issue #4 - notification port named in issue #6's scope
 *        (notify(userId, event, payload)). Log-only until #6 wires it to Redis and
 *        Socket.IO. Event names follow George's `order:<pastTenseVerb>` convention with
 *        thin payloads (2026-10-19); a failed reservation carries its reason.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

export type OrderEventName = 'order:created' | 'order:cancelled';

export interface OrderEventPayload {
  orderId: string;
  status: string;
  version: number;
  occurredAt: string;
  /** Set when a reservation failed: credit-service's error code, or why it gave up. */
  reason?: string;
}

export interface Notifier {
  notify(
    userId: string,
    event: OrderEventName,
    payload: OrderEventPayload,
  ): Promise<void>;
}

export function createLogNotifier(
  log: (message: string) => void = console.log,
): Notifier {
  return {
    async notify(userId, event, payload) {
      log(`[notify] user:${userId} ${event} ${JSON.stringify(payload)}`);
    },
  };
}
