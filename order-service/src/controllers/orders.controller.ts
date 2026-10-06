/*
 * AI Assistance Disclosure:
 * Tool: GitHub Copilot (model: GPT-5.6 Luna), date: 2026-09-29
 * Scope: Added the early return after invalid status-filter responses.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */

import type { RequestHandler } from 'express';
import type { CreditsClient } from '../clients/credits.client.js';
import type { PrismaClient } from '../db/prisma.js';
import { ErrorCode, ErrorMessage } from '../constants/errors.js';
import { isUuid } from '../utils/validation.js';
import * as ordersService from '../services/orders.service.js';
import { RequestStatus } from '../generated/prisma/enums.js';

export const createOrder =
  (prisma: PrismaClient, credits: CreditsClient): RequestHandler =>
  async (req, res) => {
    const requesterId = req.get('x-user-id'); // TODO(team): take from verified JWT
    if (!isUuid(requesterId)) {
      res
        .status(401)
        .json({ message: ErrorMessage[ErrorCode.UNAUTHENTICATED] });
      return;
    }

    const result = await ordersService.createOrder(
      prisma,
      credits,
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

    res.status(201).json(result.order);
  };

export const getOrders =
  (prisma: PrismaClient): RequestHandler =>
  async (req, res) => {
    const statusFilter = req.query.status as RequestStatus | undefined;
    const result = await ordersService.getOrders(prisma, statusFilter);

    if (result.ok) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  };

export const transitionOrder =
  (prisma: PrismaClient, newStatus: RequestStatus): RequestHandler =>
  async (req, res) => {
    const actorId = req.get('x-user-id'); // TODO(team): take from verified JWT
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
  return 400;
}
