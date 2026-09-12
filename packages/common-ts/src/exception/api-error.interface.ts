import { ErrorCodeType } from './error-codes.constant';

export interface ErrorDetail {
  field: string;
  issue: string;
}

/**
 * Standard structured API error payload matching LearnUP platform contract.
 */
export interface ApiError {
  code: ErrorCodeType | string;
  message: string;
  details?: ErrorDetail[] | null;
  correlationId?: string | null;
}
