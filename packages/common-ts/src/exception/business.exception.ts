import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ErrorCode, ErrorCodeType } from './error-codes.constant';
import { ErrorDetail } from './api-error.interface';

/**
 * Exception representing business rule violations or domain invariant failures (HTTP 400).
 */
export class BusinessException extends BaseException {
  constructor(
    message: string,
    errorCode: ErrorCodeType | string = ErrorCode.INVALID_INPUT,
    details?: ErrorDetail[] | null,
  ) {
    super(errorCode, message, HttpStatus.BAD_REQUEST, details);
  }
}
