import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
export declare const REQUEST_CONTEXT_KEY = "LEARNUP_REQUEST_CONTEXT";
export declare class TenantContextInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
