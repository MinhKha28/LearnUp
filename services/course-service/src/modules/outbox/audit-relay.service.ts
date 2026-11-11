import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AuditClient, CourseAuditRecord } from '../../infrastructure/clients/audit/audit.client';
import { CourseAuditRelayRepository } from './audit-relay.repository';

/**
 * UC23: send Course's own AuditRecorded events independently from Kafka.
 * HTTP happens AFTER a short claim transaction; a stable event id provides
 * deduplication at Audit Service across restarts and ambiguous deliveries.
 */
@Injectable()
export class CourseAuditRelayService implements OnModuleDestroy {
  private readonly logger = new Logger(CourseAuditRelayService.name);
  private running: Promise<void> | null = null;
  private stopped = false;
  private missingConfigLogged = false;

  constructor(
    private readonly repository: CourseAuditRelayRepository,
    private readonly client: AuditClient,
  ) {}

  @Interval(1000)
  tick(): Promise<void> {
    if (this.stopped || this.running) return this.running ?? Promise.resolve();
    this.running = this.run()
      .catch(() => {
        this.logger.warn('Course Audit Relay unavailable; pending events retained');
      })
      .finally(() => { this.running = null; });
    return this.running;
  }

  private async run(): Promise<void> {
    if (!this.client.isConfigured()) {
      if (!this.missingConfigLogged) {
        this.logger.warn('AUDIT_SERVICE_URL missing: Course Audit events remain pending');
        this.missingConfigLogged = true;
      }
      return;
    }
    this.missingConfigLogged = false;

    for (let index = 0; index < 20 && !this.stopped; index++) {
      const row = await this.repository.claim();
      if (!row) break;
      try {
        const payload = row.payload as unknown as CourseAuditRecord;
        if (
          payload.organizationId !== row.organization_id ||
          payload.targetResourceId !== row.aggregate_id ||
          payload.actionType !== 'COURSE_OWNERSHIP_TRANSFERRED' ||
          payload.actorRole !== 'ORGANIZER' ||
          payload.occurredAt !== row.occurred_at.toISOString()
        ) {
          throw new Error('INVALID_AUDIT_EVENT');
        }
        await this.client.record(row.id, payload);
        await this.repository.complete(row);
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        const code = status ? 'AUDIT_HTTP_' + status : 'AUDIT_DELIVERY_FAILED';
        await this.repository.retry(row, code);
        this.logger.warn('Course Audit delivery retry eventId=' + row.id + ' code=' + code);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.running;
  }
}
