import type { createRequestPayload } from '../types/requests.js';
import { ErrorCode } from '../constants/errors.js';

export const createRequest = (
  requestPayload: createRequestPayload,
): ErrorCode[] => {
  let errors: ErrorCode[] = [];

  console.log('VALIDATING PAYLOAD');
  if (!requestPayload.supplier) {
    errors.push(ErrorCode.MISSING_SUPPLIER);
  }
  if (!requestPayload.description) {
    errors.push(ErrorCode.MISSING_DESCRIPTION);
  }
  if (!requestPayload.deliveryLocation) {
    errors.push(ErrorCode.MISSING_DELIVERY_LOCATION);
  }
  if (!requestPayload.credits) {
    errors.push(ErrorCode.MISSING_CREDITS_OFFERED);
  } else if (requestPayload.credits <= 0) {
    errors.push(ErrorCode.INVALID_CREDITS_OFFERED);
  }

  if (!!errors.length) {
    return errors;
  }

  console.log('CREATING REQUEST');
  // TODO: Create request and insert into db
  return errors;
};
