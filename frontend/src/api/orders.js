/*
 * AI Assistance Disclosure:
 * Tool: Copilot SDK (model: unspecified by runtime), date: 2026-10-16
 * Scope: Added the frontend client for the order-service list endpoint. The endpoint path and
 * response shape follow order-service/src/routes/orders.routes.ts and its controller.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: <leave blank — the human author fills this in after validating>
 */

import { request } from './http'

export const listOrders = (status) => request('/orders', { query: { status } })
