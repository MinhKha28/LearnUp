import { Injectable, LoggerService, Optional } from '@nestjs/common';
import { TenantContext } from '../context/tenant-context';

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  service: string;
  correlationId?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  message: string;
  context?: string | null;
  stack?: string | null;
  extra?: Record<string, unknown>;
}

/**
 * Structured JSON logger for LearnUP microservices ensuring consistent log formats.
 */
@Injectable()
export class StructuredLogger implements LoggerService {
  private serviceName: string;

  constructor(@Optional() serviceName = 'learnup-service') {
    this.serviceName = serviceName;
  }

  setServiceName(serviceName: string): void {
    this.serviceName = serviceName;
  }

  log(message: string, context?: string, extra?: Record<string, unknown>): void {
    this.writeEntry('INFO', message, context, undefined, extra);
  }

  error(message: string, stack?: string, context?: string, extra?: Record<string, unknown>): void {
    this.writeEntry('ERROR', message, context, stack, extra);
  }

  warn(message: string, context?: string, extra?: Record<string, unknown>): void {
    this.writeEntry('WARN', message, context, undefined, extra);
  }

  debug(message: string, context?: string, extra?: Record<string, unknown>): void {
    this.writeEntry('DEBUG', message, context, undefined, extra);
  }

  verbose(message: string, context?: string, extra?: Record<string, unknown>): void {
    this.writeEntry('VERBOSE', message, context, undefined, extra);
  }

  private writeEntry(
    level: string,
    message: string,
    context?: string,
    stack?: string,
    extra?: Record<string, unknown>,
  ): void {
    const store = TenantContext.getStore();

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      correlationId: store?.correlationId || null,
      organizationId: store?.organizationId || null,
      userId: store?.userId || null,
      message,
      context: context || null,
      stack: stack || null,
      extra,
    };

    const serialized = JSON.stringify(entry);
    if (level === 'ERROR') {
      console.error(serialized);
    } else if (level === 'WARN') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }
}
