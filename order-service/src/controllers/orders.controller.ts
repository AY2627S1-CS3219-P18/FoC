/*
 * AI Assistance Disclosure:
 * Tool: GitHub Copilot (model: GPT-5.6 Luna), date: 2026-09-29
 * Scope: Added the early return after invalid status-filter responses.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 * Scope (2026-10-12): Mapped edit-order error codes to user-facing messages.
 * Author review: tng wen xi
 * Scope (2026-10-12): Mapped optimistic-lock edit conflicts to HTTP 409.
 * Author review: tng wen xi
 * Scope (2026-10-13): Passed the credit client through status transitions so
 *        requester cancellation releases the persisted reservation.
 * Author review: tng wen xi
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope (2026-10-20): Issue #5 - ORDER_EXPIRED maps to 409 (George: self-accept 403,
 *        every other accept rejection 409).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Issue #4 - POST /orders answers 202 with the `pending` order (George,
 *        2026-10-20); credit calls moved to the worker, so no credit client here.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Issue #11 - GET /orders delegates to the listing service: 200
 *        { ok, orders, nextCursor }; 400 { message } for unknown or invalid query
 *        parameters (previously an invalid status answered 500).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import type { RequestHandler } from 'express';
import type { PrismaClient } from '../db/prisma.js';
import { ErrorCode, ErrorMessage } from '../constants/errors.js';
import { isUuid } from '../utils/validation.js';
import * as ordersService from '../services/orders.service.js';
import { listOrders } from '../services/order-listing.service.js';
import { RequestStatus } from '../generated/prisma/enums.js';

export const createOrder =
  (prisma: PrismaClient): RequestHandler =>
  async (req, res) => {
    const requesterId = req.user?.user_id;
    if (!isUuid(requesterId)) {
      res
        .status(401)
        .json({ message: ErrorMessage[ErrorCode.UNAUTHENTICATED] });
      return;
    }

    const result = await ordersService.createOrder(
      prisma,
      requesterId,
      req.body ?? {},
    );
    if (!result.ok) {
      const errorMessageString = result.errors
        .map((e) => ErrorMessage[e])
        .join('\n');
      res
        .status(statusFor(result.errors))
        .json({ message: errorMessageString });
      return;
    }

    // 202: accepted as `pending`; credit reservation completes asynchronously.
    res.status(202).json(result.order);
  };

export const getOrders =
  (prisma: PrismaClient): RequestHandler =>
  async (req, res) => {
    const result = await listOrders(prisma, req.query);
    if (!result.ok) {
      const message = result.errors
        .map((e) => `${ErrorMessage[e.code]} (${e.param})`)
        .join('\n');
      res.status(400).json({ message });
      return;
    }
    res.status(200).json(result);
  };

export const editOrder =
  (prisma: PrismaClient): RequestHandler =>
  async (req, res) => {
    const actorId = req.user?.user_id;
    if (!isUuid(actorId)) {
      res
        .status(401)
        .json({ message: ErrorMessage[ErrorCode.UNAUTHENTICATED] });
      return;
    }
    const orderId = req.params.id as string;
    const payload = req.body ?? {};

    const result = await ordersService.editOrder(
      prisma,
      actorId,
      orderId,
      payload,
    );
    if (result.ok) {
      res.status(200).json(result.order);
    } else {
      const errorMessageString = result.errors
        .map((e) => ErrorMessage[e])
        .join('\n');
      res.status(statusFor(result.errors)).json({
        message: errorMessageString,
      });
    }
  };

export const transitionOrder =
  (prisma: PrismaClient, newStatus: RequestStatus): RequestHandler =>
  async (req, res) => {
    const actorId = req.user?.user_id;
    if (!isUuid(actorId)) {
      res
        .status(401)
        .json({ message: ErrorMessage[ErrorCode.UNAUTHENTICATED] });
      return;
    }

    const orderId = req.params.id as string;

    // const response = await ordersService.pickupOrder(prisma, actorId, orderId);
    const response = await ordersService.transitionOrder(
      prisma,
      orderId,
      newStatus,
      actorId,
      new Date(),
    );

    if (response.ok) {
      res.status(200).json(response);
    } else {
      const errors = [response.error];
      const errorCode = statusFor(errors);
      res.status(errorCode).json(response);
    }
  };

function statusFor(errors: ErrorCode[]): number {
  if (errors.includes(ErrorCode.CREDIT_SERVICE_UNAVAILABLE)) return 503;
  if (errors.includes(ErrorCode.INSUFFICIENT_CREDITS)) return 422;
  if (errors.includes(ErrorCode.FORBIDDEN)) return 403;
  if (errors.includes(ErrorCode.INVALID_TRANSITION)) return 409;
  if (errors.includes(ErrorCode.ORDER_CONFLICT)) return 409;
  if (errors.includes(ErrorCode.ORDER_EXPIRED)) return 409;
  return 400;
}
