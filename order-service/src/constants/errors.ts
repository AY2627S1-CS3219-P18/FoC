/*
 * AI Assistance Disclosure:
 * Tool: GitHub Copilot (model: GPT-5.6 Luna), date: 2026-10-12
 * Scope: Added the invalid-field error code and message for malformed edit
 *        payloads. No requirements, architecture, schema, or API decisions
 *        were made by the AI tool.
 * Author review:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope (2026-10-20): Issue #5 - ORDER_EXPIRED for accepting an order past its
 *        complete-by (George: expired = past completeBy if set; 409). Name and message
 *        follow the existing codes' convention.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Issue #11 - listing query errors (unknown parameter, invalid
 *        value, invalid cursor), named by convention.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): F18.1.1 - ORDER_NOT_EDITABLE for editing a request that
 *        is not open, named by convention.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

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
  INVALID_FIELD = 'INVALID_FIELD',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  FORBIDDEN = 'FORBIDDEN',
  ORDER_CONFLICT = 'ORDER_CONFLICT',
  COMPLETE_BY_IN_PAST = 'COMPLETE_BY_IN_PAST',
  DEADLINE_NOT_REACHED = 'DEADLINE_NOT_REACHED',
  ORDER_EXPIRED = 'ORDER_EXPIRED',
  ORDER_NOT_EDITABLE = 'ORDER_NOT_EDITABLE',
  UNKNOWN_QUERY_PARAMETER = 'UNKNOWN_QUERY_PARAMETER',
  INVALID_QUERY_PARAMETER = 'INVALID_QUERY_PARAMETER',
  INVALID_CURSOR = 'INVALID_CURSOR',
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
    'Delivery location must be a valid location id.',
  [ErrorCode.MISSING_CREDITS_OFFERED]:
    'Request is missing number of credits offered.',
  [ErrorCode.INVALID_CREDITS_OFFERED]: 'Invalid number of credits offered.',
  [ErrorCode.INVALID_COMPLETE_BY]: 'Complete-by time must be a valid date.',
  [ErrorCode.INVALID_ADDITIONAL_DETAILS]: 'Additional details must be text.',
  [ErrorCode.INVALID_FIELD]: 'Payload contains an unsupported field.',
  [ErrorCode.ORDER_NOT_FOUND]: 'Order not found.',
  [ErrorCode.INVALID_TRANSITION]:
    'This order cannot move to that status from its current status.',
  [ErrorCode.FORBIDDEN]: 'You are not allowed to perform this action.',
  [ErrorCode.ORDER_CONFLICT]:
    'This order was changed by someone else. Refresh and try again.',
  [ErrorCode.COMPLETE_BY_IN_PAST]: 'Complete-by time must be in the future.',
  [ErrorCode.DEADLINE_NOT_REACHED]:
    'An ongoing request can only be cancelled after its complete-by time has passed.',
  [ErrorCode.ORDER_EXPIRED]: 'This request has expired.',
  [ErrorCode.ORDER_NOT_EDITABLE]: 'Only open requests can be edited.',
  [ErrorCode.UNKNOWN_QUERY_PARAMETER]: 'Unknown query parameter.',
  [ErrorCode.INVALID_QUERY_PARAMETER]: 'Invalid query parameter value.',
  [ErrorCode.INVALID_CURSOR]:
    'The page cursor is invalid or was issued for a different sort.',
  [ErrorCode.INSUFFICIENT_CREDITS]:
    'You do not have enough credits for this request.',
  [ErrorCode.CREDIT_SERVICE_UNAVAILABLE]:
    'Credits could not be reserved right now. Please try again.',
  [ErrorCode.INVALID_STATUS]: 'Status provided is invalid.',
};
