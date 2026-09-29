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
    if (
      statusFilter !== undefined &&
      !Object.values(RequestStatus).includes(statusFilter)
    ) {
      const errorCode = ErrorCode.INVALID_STATUS;
      res.status(statusFor([errorCode])).json({
        success: false,
        message: ErrorMessage[errorCode],
      });
      return;
    }
    console.log('statusFilter: ', statusFilter);
    try {
      const result = await ordersService.getOrders(prisma, statusFilter);
      res.status(200).json({
        success: true,
        orders: result,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({
        success: false,
        orders: [],
      });
    }
  };

function statusFor(errors: ErrorCode[]): number {
  if (errors.includes(ErrorCode.CREDIT_SERVICE_UNAVAILABLE)) return 503;
  if (errors.includes(ErrorCode.INSUFFICIENT_CREDITS)) return 422;
  return 400;
}
