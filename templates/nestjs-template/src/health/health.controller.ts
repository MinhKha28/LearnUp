import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { RequestContext } from '@learnup/common-ts/core';
import { TenantContext } from '@learnup/common-ts/adapters/nestjs';

/**
 * Standard health check and ping controller for NestJS microservices.
 * Contains ZERO business logic.
 */
@Controller()
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get('healthz')
  @HealthCheck()
  check() {
    return this.health.check([]);
  }

  @Get('api/v1/ping')
  ping(@TenantContext() ctx: RequestContext) {
    return {
      status: 'UP',
      organizationId: ctx?.organizationId || 'NONE',
      userId: ctx?.userId || 'ANONYMOUS',
    };
  }
}
