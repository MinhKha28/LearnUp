import { ErrorCodeType } from './error-codes.constant';
export interface ErrorDetail {
    field: string;
    issue: string;
}
export interface ApiError {
    code: ErrorCodeType | string;
    message: string;
    details?: ErrorDetail[] | null;
    correlationId?: string | null;
}
