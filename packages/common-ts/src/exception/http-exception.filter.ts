import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { createErrorResponse } from '../response/api-response.interface';
import { ApiError, ErrorDetail } from './api-error.interface';
import { ErrorCode, ErrorCodeType } from './error-codes.constant';
import { HeaderConstants } from '../context/header.constants';
import { BaseException } from './base.exception';

/**
 * Global NestJS Exception Filter mapping all exceptions to standard LearnUP ApiResponse/ApiError format.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCodeType | string = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected internal platform error occurred.';
    let details: ErrorDetail[] | null = null;

    if (exception instanceof BaseException) {
      status = exception.getStatus();
      code = exception.errorCode;
      message = exception.message;
      details = exception.details || null;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string) || exception.message;
        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          details = resObj.message.map((msg: string) => ({
            field: 'request',
            issue: msg,
          }));
        }
        if (typeof resObj.code === 'string') {
          code = resObj.code;
        }
      }

      if (code === ErrorCode.INTERNAL_ERROR) {
        code = this.mapStatusToErrorCode(status);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    const correlationId =
      (request?.headers?.[HeaderConstants.X_CORRELATION_ID] as string) ||
      (request?.headers?.['x-correlation-id'] as string) ||
      null;

    const apiError: ApiError = {
      code,
      message,
      details,
      correlationId,
    };

    response.status(status).json(createErrorResponse(apiError));
  }

  private mapStatusToErrorCode(status: number): ErrorCodeType {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.INVALID_INPUT;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.SERVICE_UNAVAILABLE;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
