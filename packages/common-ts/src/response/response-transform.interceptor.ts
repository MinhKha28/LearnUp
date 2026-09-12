import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, createSuccessResponse } from './api-response.interface';
import { SKIP_RESPONSE_TRANSFORM_KEY } from './skip-transform.decorator';
import { PageResponse } from '../pagination/page-response.interface';

/**
 * NestJS Interceptor that automatically transforms controller return values into standard ApiResponse<T> envelopes.
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<unknown>>
{
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>> {
    const isSkipped = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isSkipped) {
      return next.handle();
    }

    return next.handle().pipe(
      map((result) => {
        // If response is already an ApiResponse envelope, pass through
        if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          'timestamp' in result
        ) {
          return result;
        }

        // If response is a PageResponse, extract items and meta
        if (
          result &&
          typeof result === 'object' &&
          'items' in result &&
          'meta' in result
        ) {
          const pageResult = result as PageResponse<unknown>;
          return createSuccessResponse(pageResult.items, pageResult.meta);
        }

        return createSuccessResponse(result);
      }),
    );
  }
}
