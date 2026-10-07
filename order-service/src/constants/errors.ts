export enum ErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  MISSING_SUPPLIER = 'MISSING_SUPPLIER',
  INVALID_SUPPLIER = 'INVALID_SUPPLIER',
  MISSING_DESCRIPTION = 'MISSING_DESCRIPTION',
  INVALID_DESCRIPTION = 'INVALID_DESCRIPTION',
  MISSING_DELIVERY_LOCATION = 'MISSING_DELIVERY_LOCATION',
  INVALID_DELIVERY_LOCATION = 'INVALID_DELIVERY_LOCATION',
  MISSING_CREDITS_OFFERED = 'MISSING_CREDITS_OFFERED',
  INVALID_CREDITS_OFFERED = 'INVALID_CREDITS_OFFERED',
  INVALID_COMPLETE_BY = 'INVALID_COMPLETE_BY',
  INVALID_ADDITIONAL_DETAILS = 'INVALID_ADDITIONAL_DETAILS',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  FORBIDDEN = 'FORBIDDEN',
  ORDER_CONFLICT = 'ORDER_CONFLICT',
  COMPLETE_BY_IN_PAST = 'COMPLETE_BY_IN_PAST',
  DEADLINE_NOT_REACHED = 'DEADLINE_NOT_REACHED',
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  CREDIT_SERVICE_UNAVAILABLE = 'CREDIT_SERVICE_UNAVAILABLE',
  INVALID_STATUS = 'INVALID_STATUS',
}

export const ErrorMessage: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHENTICATED]: 'Unauthenticated.',
  [ErrorCode.MISSING_SUPPLIER]: 'Request is missing a supplier.',
  [ErrorCode.INVALID_SUPPLIER]: 'Supplier id is invalid.',
  [ErrorCode.MISSING_DESCRIPTION]: 'Request is missing a description.',
  [ErrorCode.INVALID_DESCRIPTION]: 'Description must be non-empty text.',
  [ErrorCode.MISSING_DELIVERY_LOCATION]:
    'Request is missing a delivery location.',
  [ErrorCode.INVALID_DELIVERY_LOCATION]:
    'Delivery location must be non-empty text.',
  [ErrorCode.MISSING_CREDITS_OFFERED]:
    'Request is missing number of credits offered.',
  [ErrorCode.INVALID_CREDITS_OFFERED]: 'Invalid number of credits offered.',
  [ErrorCode.INVALID_COMPLETE_BY]: 'Complete-by time must be a valid date.',
  [ErrorCode.INVALID_ADDITIONAL_DETAILS]: 'Additional details must be text.',
  [ErrorCode.ORDER_NOT_FOUND]: 'Order not found.',
  [ErrorCode.INVALID_TRANSITION]:
    'This order cannot move to that status from its current status.',
  [ErrorCode.FORBIDDEN]: 'You are not allowed to perform this action.',
  [ErrorCode.ORDER_CONFLICT]:
    'This order was changed by someone else. Refresh and try again.',
  [ErrorCode.COMPLETE_BY_IN_PAST]: 'Complete-by time must be in the future.',
  [ErrorCode.DEADLINE_NOT_REACHED]:
    'An ongoing request can only be cancelled after its complete-by time has passed.',
  [ErrorCode.INSUFFICIENT_CREDITS]:
    'You do not have enough credits for this request.',
  [ErrorCode.CREDIT_SERVICE_UNAVAILABLE]:
    'Credits could not be reserved right now. Please try again.',
  [ErrorCode.INVALID_STATUS]: 'Status provided is invalid.',
};
