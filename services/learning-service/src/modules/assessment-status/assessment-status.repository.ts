import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { activateEnrollmentSql } from '../material-progress/material-progress.repository';
import { requestCompletion } from '../course-completion/completion-request';
import {
  decodeAssessment,
  type AssessmentDelivery,
} from './assessment-status.event';

@Injectable()
export class AssessmentStatusRepository {
  constructor(private readonly db: PrismaService) {}
  async receive(delivery: AssessmentDelivery): Promise<string | undefined> {
    const decoded = decodeAssessment(delivery);
    return this.db.$transaction(async (tx) => {
      if (!decoded.event) {
        await this.quarantine(
          tx,
          delivery,
          decoded.payload,
          decoded.reason!,
          decoded.eventId,
        );
        return decoded.reason;
      }
      const event = decoded.event,
        d = event.data;
      const [enrollment] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM enrollments
        WHERE organization_id=${event.organizationId}::uuid AND learner_id=${d.learnerId}::uuid AND course_id=${d.courseId}::uuid FOR UPDATE`;
      if (!enrollment) {
        await this.quarantine(
          tx,
          delivery,
          decoded.payload,
          'ENROLLMENT_NOT_FOUND',
          event.eventId,
        );
        return 'ENROLLMENT_NOT_FOUND';
      }
      if (
        d.status === 'Started' ||
        d.status === 'Submitted' ||
        d.status === 'Resubmitted'
      )
        await tx.$executeRaw(
          activateEnrollmentSql(
            enrollment.id,
            event.organizationId,
            new Date(d.firstActivityAt ?? event.occurredAt),
          ),
        );
      // The hash is not an ordered revision. Every signal requests a fresh REST snapshot.
      await requestCompletion(
        tx,
        event.organizationId,
        enrollment.id,
        'assessment',
      );
      return undefined;
    });
  }
  private async quarantine(
    tx: Prisma.TransactionClient,
    delivery: AssessmentDelivery,
    payload: unknown,
    reason: string,
    eventId?: string,
  ) {
    const json = JSON.stringify(payload);
    // JSON allows NUL and lone surrogate escapes that PostgreSQL jsonb rejects.
    // Retain the original delivery losslessly rather than blocking a partition.
    const stored = /\\u(?:0000|d[89a-f][0-9a-f]{2})/i.test(json)
      ? JSON.stringify({
          encoding: 'base64',
          value: delivery.value?.toString('base64') ?? null,
        })
      : json;
    const safeEventId = eventId?.includes('\0') ? null : (eventId ?? null);
    await tx.$executeRaw`INSERT INTO assessment_event_quarantine(id,topic,"partition","offset",event_id,reason,payload)
      VALUES (${randomUUID()}::uuid,${delivery.topic},${delivery.partition},${BigInt(delivery.offset)},${safeEventId},${reason},${stored}::jsonb)
      ON CONFLICT(topic,"partition","offset") DO NOTHING`;
  }
}
