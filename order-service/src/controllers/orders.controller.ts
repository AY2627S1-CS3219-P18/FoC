import type { RequestHandler } from 'express';
import type { PrismaClient } from '../db/prisma.js';
import { ErrorCode, ErrorMessage } from '../constants/errors.js';
import { isUuid } from '../utils/validation.js';
import * as ordersService from '../services/orders.service.js';

export const createOrder =
  (prisma: PrismaClient): RequestHandler =>
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
      requesterId,
      req.body ?? {},
    );
    if (!result.ok) {
      const errorMessageString = result.errors
        .map((e) => ErrorMessage[e])
        .join('\n');
      res.status(400).json({ message: errorMessageString });
      return;
    }

    res.status(201).json(result.order);
  };
