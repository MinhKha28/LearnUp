import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface CourseAuditRecord {
  organizationId: string;
  actorUserId: string;
  actorRole: string;
  actionType: string;
  targetResourceType: string;
  targetResourceId: string;
  courseId: string;
  fromInstructorId: string;
  toInstructorId: string;
  occurredAt: string;
  reason?: string;
}

/** Infrastructure adapter only: no Course business rules or database access. */
@Injectable()
export class AuditClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('AUDIT_SERVICE_URL')?.trim());
  }

  async record(eventId: string, record: CourseAuditRecord): Promise<void> {
    const url = this.config.get<string>('AUDIT_SERVICE_URL')?.trim();
    if (!url) throw new Error('AUDIT_SERVICE_URL_MISSING');

    const key = this.config.getOrThrow<string>('INTERNAL_SERVICE_KEY');
    await firstValueFrom(
      this.http.post(
        url.replace(/\/+$/, '') + '/api/v1/audit/logs',
        {
          organizationId: record.organizationId,
          actorUserId: record.actorUserId,
          actorRole: record.actorRole,
          actionType: record.actionType,
          targetResourceType: record.targetResourceType,
          targetResourceId: record.targetResourceId,
          details: JSON.stringify({
            courseId: record.courseId,
            fromInstructorId: record.fromInstructorId,
            toInstructorId: record.toInstructorId,
            occurredAt: record.occurredAt,
            ...(record.reason ? { reason: record.reason } : {}),
          }),
          correlationId: eventId,
          occurredAt: record.occurredAt,
        },
        { headers: { 'x-internal-key': key }, timeout: 5000 },
      ),
    );
  }
}
