export const AUDIT_OPERATION = {
  TRANSACTION_CREATE: 'transaction_create',
  CHECK_STATUS: 'check_status',
  BALANCE_ASSIGN: 'balance_assign',
} as const;

export type AuditOperationType =
  (typeof AUDIT_OPERATION)[keyof typeof AUDIT_OPERATION];

export const AUDIT_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending',
} as const;

export type AuditStatus = (typeof AUDIT_STATUS)[keyof typeof AUDIT_STATUS];

export type RecordAuditLogInput = {
  operationType: AuditOperationType;
  status: AuditStatus;
  clientId?: number | null;
  userId?: number | null;
  referenceId?: string | null;
  amount?: number | string | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
  message?: string | null;
};
