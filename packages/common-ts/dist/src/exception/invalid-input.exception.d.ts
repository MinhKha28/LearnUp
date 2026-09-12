import { BaseException } from './base.exception';
import { ErrorDetail } from './api-error.interface';
export declare class InvalidInputException extends BaseException {
    constructor(message?: string, details?: ErrorDetail[] | null);
}
