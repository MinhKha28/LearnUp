import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ErrorCode } from './error-codes.constant';

/**
 * Exception thrown when an operation conflicts with the current resource state (HTTP 409).
 */
export class ConflictException extends BaseException {
  constructor(resourceNameOrMessage: string, field?: string, value?: string) {
    const message =
      field && value
        ? `${resourceNameOrMessage} with ${field} '${value}' already exists.`
        : resourceNameOrMessage;
    super(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT);
  }
}
