import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response as ExpressResponse } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE } from '../decorator/customize';
import { ApiResponse } from '@learnup/ts-common';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<ExpressResponse>();
    const message =
      this.reflector.get<string>(RESPONSE_MESSAGE, context.getHandler()) ?? '';
    return next.handle().pipe(
      map((data) => ({
        statusCode: response.statusCode,
        message: message,
        data,
      })),
    );
  }
}
