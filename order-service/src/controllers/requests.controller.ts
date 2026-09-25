import type { Request, Response } from 'express';
import type { createRequestPayload } from '../types/requests.js';

import * as requestsService from '../services/requests.service.js';
import { ErrorMessage, OK } from '../constants/errors.js';

export const createRequest = (req: Request, res: Response) => {
  console.log(req.body);
  const details: createRequestPayload = req.body;
  const response = requestsService.createRequest(details);
  if (response !== OK) {
    console.log(ErrorMessage[response]);
  }
  res.status(200).json({ message: 'hi' });
};
