import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, createSuccessResponse } from '../../core/api/api-response.interface';
import { PageResponse } from '../../core/api/page-response.interface';

/**
 * NestJS Interceptor that wraps all controller returns into the universal ApiResponse<T> format.
 */
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<unknown>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(
      map((result) => {
        // If already formatted as ApiResponse, return as is
        if (result && typeof result === 'object' && 'success' in result && 'timestamp' in result) {
          return result;
        }

        // If returned as a paginated PageResponse, extract items and meta
        if (result && typeof result === 'object' && 'items' in result && 'meta' in result) {
          const pageRes = result as PageResponse<unknown>;
          return createSuccessResponse(pageRes.items, pageRes.meta);
        }

        return createSuccessResponse(result);
      }),
    );
  }
}
