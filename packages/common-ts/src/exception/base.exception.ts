import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeType } from './error-codes.constant';
import { ErrorDetail } from './api-error.interface';

/**
 * Base platform exception for LearnUP TypeScript/NestJS services.
 */
export abstract class BaseException extends HttpException {
  readonly errorCode: ErrorCodeType | string;
  readonly details?: ErrorDetail[] | null;

  constructor(
    errorCode: ErrorCodeType | string,
    message: string,
    status: HttpStatus,
    details?: ErrorDetail[] | null,
  ) {
    super(
      {
        code: errorCode,
        message,
        details: details ?? null,
      },
      status,
    );
    this.errorCode = errorCode;
    this.details = details ?? null;
  }
}
