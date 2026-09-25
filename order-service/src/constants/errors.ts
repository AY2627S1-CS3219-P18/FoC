export const OK = 'ok';
export enum ErrorCode {
  INVALID_CREDITS_OFFERED = 'INVALID_CREDITS_OFFERED',
  MISSING_CREDITS_OFFERED = 'MISSING_CREDITS_OFFERED',
  MISSING_DELIVERY_LOCATION = 'MISSING_DELIVERY_LOCATION',
  MISSING_SUPPLIER = 'MISSING_SUPPLIER',
  MISSING_DESCRIPTION = 'MISSING_DESCRIPTION',
}

export const ErrorMessage = {
  [ErrorCode.INVALID_CREDITS_OFFERED]: 'Invalid number of credits offered.',
  [ErrorCode.MISSING_DELIVERY_LOCATION]:
    'Request is missing a delivery location.',
  [ErrorCode.MISSING_SUPPLIER]: 'Request is missing a supplier',
  [ErrorCode.MISSING_DESCRIPTION]: 'Request is missing a description',
};
