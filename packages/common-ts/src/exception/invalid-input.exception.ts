import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ErrorCode } from './error-codes.constant';
import { ErrorDetail } from './api-error.interface';

/**
 * Exception thrown when input validation fails (HTTP 400).
 */
export class InvalidInputException extends BaseException {
  constructor(message = 'Invalid input provided.', details?: ErrorDetail[] | null) {
    super(ErrorCode.INVALID_INPUT, message, HttpStatus.BAD_REQUEST, details);
  }
}
