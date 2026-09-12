import { LoggerService } from '@nestjs/common';
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
export declare class StructuredLogger implements LoggerService {
    private serviceName;
    constructor(serviceName?: string);
    setServiceName(serviceName: string): void;
    log(message: string, context?: string, extra?: Record<string, unknown>): void;
    error(message: string, stack?: string, context?: string, extra?: Record<string, unknown>): void;
    warn(message: string, context?: string, extra?: Record<string, unknown>): void;
    debug(message: string, context?: string, extra?: Record<string, unknown>): void;
    verbose(message: string, context?: string, extra?: Record<string, unknown>): void;
    private writeEntry;
}
