export type ApiErrorCode = 'INVALID_INPUT' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'RESOURCE_NOT_FOUND' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'SERVICE_UNAVAILABLE';
export interface ErrorDetail {
    field: string;
    issue: string;
}
export interface ApiError {
    code: ApiErrorCode | string;
    message: string;
    details?: ErrorDetail[];
    correlationId?: string;
}
