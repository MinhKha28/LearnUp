import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../core/api/api-response.interface';
export declare class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<unknown>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>>;
}
