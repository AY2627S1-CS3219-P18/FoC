/*
 * AI Assistance Disclosure:
 * Tool: Copilot SDK (model: unspecified by runtime), date: 2026-10-16
 * Scope: Added the frontend client for the order-service list endpoint. The endpoint path and
 * response shape follow order-service/src/routes/orders.routes.ts and its controller.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 *
 * Tool: Copilot SDK (model: unspecified by runtime), date: 2026-10-20
 * Scope: Added the frontend client for creating orders with the existing POST /orders contract.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */

import { request } from "./http";

export const createOrder = (payload) =>
  request("/orders", { method: "POST", json: payload });
export const listOrders = (status) => request("/orders", { query: { status } });
