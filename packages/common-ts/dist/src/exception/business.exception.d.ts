import { BaseException } from './base.exception';
import { ErrorCodeType } from './error-codes.constant';
import { ErrorDetail } from './api-error.interface';
export declare class BusinessException extends BaseException {
    constructor(message: string, errorCode?: ErrorCodeType | string, details?: ErrorDetail[] | null);
}
