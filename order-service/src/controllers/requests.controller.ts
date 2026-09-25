import type { Request, Response } from 'express';
import type { createRequestPayload } from '../types/requests.js';

import * as requestsService from '../services/requests.service.js';
import { ErrorMessage } from '../constants/errors.js';

export const createRequest = (req: Request, res: Response) => {
  console.log(req.body);
  const details: createRequestPayload = req.body;
  const errors = requestsService.createRequest(details);
  if (!!errors.length) {
    console.log('The payload is invalid for the following reasons:\n');

    const errorMessages = errors.map((error) => ErrorMessage[error]);
    const errorMessageString = errorMessages.join('\n');

    console.log(errorMessageString);
    res.status(400).json({ message: errorMessageString });
  }
  res.status(200).json({ message: 'Successfully created request' });
};
