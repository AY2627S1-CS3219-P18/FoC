import type { createRequestPayload } from '../types/requests.js';
import { OK, ErrorCode } from '../constants/errors.js';

type CreateRequestResult = typeof OK | ErrorCode;

export const createRequest = (
  requestPayload: createRequestPayload,
): CreateRequestResult => {
  // TODO: handle multiple missing fields
  console.log('CREATING REQUEST');
  console.log('VALIDATING PAYLOAD');
  if (!requestPayload.supplier) {
    return ErrorCode.MISSING_SUPPLIER;
  }
  if (!requestPayload.description) {
    return ErrorCode.MISSING_DESCRIPTION;
  }
  if (!requestPayload.deliveryLocation) {
    return ErrorCode.MISSING_DELIVERY_LOCATION;
  }
  if (!requestPayload.credits) {
    return ErrorCode.MISSING_CREDITS_OFFERED;
  }
  if (requestPayload.credits <= 0) {
    return ErrorCode.INVALID_CREDITS_OFFERED;
  }
  return OK;
};
