import type { RequestHandler } from 'express';
import type { CreditsClient } from '../clients/credits.client.js';
import type { PrismaClient } from '../db/prisma.js';
import { ErrorCode, ErrorMessage } from '../constants/errors.js';
import { isUuid } from '../utils/validation.js';
import * as ordersService from '../services/orders.service.js';

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

function statusFor(errors: ErrorCode[]): number {
  if (errors.includes(ErrorCode.CREDIT_SERVICE_UNAVAILABLE)) return 503;
  if (errors.includes(ErrorCode.INSUFFICIENT_CREDITS)) return 422;
  return 400;
}
