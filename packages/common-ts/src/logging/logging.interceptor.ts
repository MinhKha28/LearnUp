import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { StructuredLogger } from './structured-logger.service';

/**
 * NestJS Interceptor that logs incoming HTTP requests and response latency in structured JSON.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger: StructuredLogger;

  constructor(serviceName = 'learnup-service') {
    this.logger = new StructuredLogger(serviceName);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    if (!req) {
      return next.handle();
    }

    const method = req.method;
    const url = req.originalUrl || req.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res?.statusCode || 200;
          this.logger.log(
            `HTTP ${method} ${url} completed with status ${statusCode} in ${duration}ms`,
            'HTTP',
            { method, url, statusCode, durationMs: duration },
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `HTTP ${method} ${url} failed after ${duration}ms: ${error.message}`,
            error.stack,
            'HTTP',
            { method, url, durationMs: duration },
          );
        },
      }),
    );
  }
}
