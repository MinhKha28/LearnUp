import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ApiResponse } from './api-response.interface';
export declare class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<unknown>> {
    private readonly reflector;
    constructor(reflector?: Reflector);
    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>>;
}
