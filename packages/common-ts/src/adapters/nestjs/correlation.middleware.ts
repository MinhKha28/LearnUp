import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { extractOrGenerateCorrelationId } from '../../core/correlation/correlation-utils';
import { HeaderConstants } from '../../core/constants/headers.constant';

/**
 * NestJS Middleware to extract or generate X-Correlation-ID and bind to response headers.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = extractOrGenerateCorrelationId(req.headers as Record<string, string | string[] | undefined>);
    req.headers[HeaderConstants.X_CORRELATION_ID] = correlationId;
    res.setHeader(HeaderConstants.X_CORRELATION_ID, correlationId);
    next();
  }
}
