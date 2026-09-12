import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ErrorCode } from './error-codes.constant';

/**
 * Exception thrown when the caller lacks required permissions or role (HTTP 403).
 */
export class ForbiddenException extends BaseException {
  constructor(message = 'Access denied.', requiredRole?: string) {
    const finalMessage = requiredRole
      ? `${message} (Required role: ${requiredRole})`
      : message;
    super(ErrorCode.FORBIDDEN, finalMessage, HttpStatus.FORBIDDEN);
  }
}
