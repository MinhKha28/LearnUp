import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Lỗi quá tải tạm thời mang retryAfterSeconds -> header Retry-After.
    const retryAfterSeconds =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as { retryAfterSeconds?: unknown })
            .retryAfterSeconds
        : undefined;

    if (
      typeof retryAfterSeconds === 'number' &&
      Number.isInteger(retryAfterSeconds) &&
      retryAfterSeconds >= 0
    ) {
      response.setHeader('Retry-After', String(retryAfterSeconds));
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: exceptionResponse,
    });
  }
}
