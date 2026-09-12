export declare const ErrorCode: {
    readonly INVALID_INPUT: 'INVALID_INPUT';
    readonly UNAUTHORIZED: 'UNAUTHORIZED';
    readonly FORBIDDEN: 'FORBIDDEN';
    readonly RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND';
    readonly CONFLICT: 'CONFLICT';
    readonly RATE_LIMITED: 'RATE_LIMITED';
    readonly INTERNAL_ERROR: 'INTERNAL_ERROR';
    readonly SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE';
};
export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
