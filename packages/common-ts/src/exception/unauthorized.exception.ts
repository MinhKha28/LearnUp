import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ErrorCode } from './error-codes.constant';

/**
 * Exception thrown when authentication is missing, invalid, or expired (HTTP 401).
 */
export class UnauthorizedException extends BaseException {
  constructor(message = 'Authentication required.') {
    super(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }
}
