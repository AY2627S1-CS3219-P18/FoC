/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope (2026-10-20): Issue #11 - deliveryLocation (text) became deliveryLocationId
 *        (supplier-service location id, George 2026-10-20).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

export interface CreateOrderPayload {
  supplierId: number;
  description: string;
  deliveryLocationId: number; // supplier-service location_id
  credits: number;
  completeBy?: string | null;
  additionalDetails?: string | null;
}

export type EditOrderPayload = Partial<CreateOrderPayload>;
