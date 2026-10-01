import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response as ExpressResponse } from 'express';
import type { ApiResponse } from '@learnup/ts-common';
import { Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE } from '../decorator/customize';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<ExpressResponse>();
    const message =
      this.reflector.get<string>(RESPONSE_MESSAGE, context.getHandler()) ?? '';

    return next.handle().pipe(
      map((data: T): ApiResponse<T> => ({
        statusCode: response.statusCode,
        message,
        data,
      })),
    );
  }
}
