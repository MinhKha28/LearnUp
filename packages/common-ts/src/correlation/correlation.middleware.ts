import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { extractOrGenerateCorrelationId } from './correlation.utils';
import { HeaderConstants } from '../context/header.constants';

/**
 * NestJS Middleware to extract or generate X-Correlation-ID and bind to request and response headers.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = extractOrGenerateCorrelationId(
      req.headers as Record<string, string | string[] | undefined>,
    );
    req.headers[HeaderConstants.X_CORRELATION_ID] = correlationId;
    res.setHeader(HeaderConstants.X_CORRELATION_ID, correlationId);
    next();
  }
}
