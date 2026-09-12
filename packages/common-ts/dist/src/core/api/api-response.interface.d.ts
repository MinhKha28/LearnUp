import { ApiError } from './api-error.interface';
import { PageMeta } from './page-meta.interface';
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T | null;
    meta?: PageMeta | null;
    error?: ApiError | null;
    timestamp: string;
}
export declare function createSuccessResponse<T>(data: T, meta?: PageMeta): ApiResponse<T>;
export declare function createErrorResponse(error: ApiError): ApiResponse<null>;
