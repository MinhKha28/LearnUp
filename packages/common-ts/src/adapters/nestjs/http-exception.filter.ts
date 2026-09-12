import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { createErrorResponse } from '../../core/api/api-response.interface';
import { ApiError, ApiErrorCode } from '../../core/api/api-error.interface';
import { HeaderConstants } from '../../core/constants/headers.constant';

/**
 * NestJS Global Exception Filter transforming all exceptions into standard LearnUP ApiError responses.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ApiErrorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected internal error occurred.';
    let details: ApiError['details'] | undefined = undefined;

    if (exception instanceof HttpException) {
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
      }

      switch (status) {
        case HttpStatus.BAD_REQUEST:
          code = 'INVALID_INPUT';
          break;
        case HttpStatus.UNAUTHORIZED:
          code = 'UNAUTHORIZED';
          break;
        case HttpStatus.FORBIDDEN:
          code = 'FORBIDDEN';
          break;
        case HttpStatus.NOT_FOUND:
          code = 'RESOURCE_NOT_FOUND';
          break;
        case HttpStatus.CONFLICT:
          code = 'CONFLICT';
          break;
        case HttpStatus.TOO_MANY_REQUESTS:
          code = 'RATE_LIMITED';
          break;
        default:
          code = 'INTERNAL_ERROR';
          break;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const correlationId = request?.headers?.[HeaderConstants.X_CORRELATION_ID] as string | undefined;

    const apiError: ApiError = {
      code,
      message,
      details,
      correlationId,
    };

    response.status(status).json(createErrorResponse(apiError));
  }
}
