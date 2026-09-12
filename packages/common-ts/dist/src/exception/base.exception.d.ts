import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeType } from './error-codes.constant';
import { ErrorDetail } from './api-error.interface';
export declare abstract class BaseException extends HttpException {
    readonly errorCode: ErrorCodeType | string;
    readonly details?: ErrorDetail[] | null;
    constructor(errorCode: ErrorCodeType | string, message: string, status: HttpStatus, details?: ErrorDetail[] | null);
}
