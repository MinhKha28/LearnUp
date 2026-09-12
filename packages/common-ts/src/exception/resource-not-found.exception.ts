import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ErrorCode } from './error-codes.constant';

/**
 * Exception thrown when a requested resource is not found (HTTP 404).
 */
export class ResourceNotFoundException extends BaseException {
  constructor(resourceNameOrMessage: string, identifier?: string) {
    const message = identifier
      ? `${resourceNameOrMessage} with identifier '${identifier}' was not found.`
      : resourceNameOrMessage;
    super(ErrorCode.RESOURCE_NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }
}
