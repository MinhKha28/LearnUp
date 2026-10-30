import type { Prisma } from '../../../generated/prisma/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ASSESSMENT_COMPLETION_CLIENT,
  type AssessmentCompletionClient,
  type CompletionSnapshot,
  CompletionClientError,
  validateCompletionSnapshot,
} from '../../infrastructure/clients/assessment/assessment-completion.client';
import {
  CompletionRepository,
  CompletionRequest,
} from './completion.repository';

const allowed = (status: string) =>
  ['NotStarted', 'InProgress', 'Exempted'].includes(status);
@Injectable()
export class CompletionService {
  private readonly logger = new Logger(CompletionService.name);
  readonly metrics = { leaseExpired: 0, generationDiscarded: 0 };
  constructor(
    private readonly repository: CompletionRepository,
    @Inject(ASSESSMENT_COMPLETION_CLIENT)
    private readonly assessment: AssessmentCompletionClient,
  ) {}
  private affected(count: number) {
    if (count === 0) this.metrics.generationDiscarded++;
  }
  /** BR-260/261, BR-236 and BR-241: completion follows facts and satisfied or waived peer duty. */
  private assessmentEligible(snapshot: CompletionSnapshot): boolean {
    const items = [
      ...snapshot.quizzes.map((q) => ({
        assessmentId: q.assessmentId,
        assessment: q.passed,
        learning:
          q.attemptId !== null &&
          q.recordedScore !== null &&
          Number(q.recordedScore) >= Number(q.passingScore),
      })),
      ...snapshot.assignments.map((a) => ({
        assessmentId: a.assessmentId,
        assessment: a.passed,
        learning:
          a.submissionId !== null &&
          a.finalizedAt !== null &&
          a.finalScore !== null &&
          Number(a.finalScore) >= Number(a.passingScore) &&
          ['Waived', 'NotApplicable', 'Satisfied'].includes(
            a.peerReview.status,
          ),
      })),
    ];
    const eligible = items.every((item) => item.learning);
    const differences = items.filter(
      (item) => item.assessment !== item.learning,
    );
    if (snapshot.eligible !== eligible || differences.length > 0)
      this.logger.warn({
        code: 'COMPLETION_SNAPSHOT_MISMATCH',
        organizationId: snapshot.organizationId,
        learnerId: snapshot.learnerId,
        courseId: snapshot.courseId,
        revision: snapshot.revision,
        assessmentEligible: snapshot.eligible,
        learningEligible: eligible,
        items: differences,
      });
    return eligible;
  }
  async evaluate(r: CompletionRequest): Promise<void> {
    if (r.expired) this.metrics.leaseExpired++;
    try {
      const e = await this.repository.enrollment(r);
      if (!e || !allowed(e.status) || e.disabled_at !== null) {
        this.affected(await this.repository.remove(r));
        return;
      }
      if (!(await this.repository.materials(r, e.course_id)).ready) {
        this.affected(await this.repository.remove(r));
        return;
      }
      // No database transaction or row lock spans this network call.
      const snapshot = validateCompletionSnapshot(
        await this.assessment.getCompletionSnapshot(
          r.organization_id,
          e.learner_id,
          e.course_id,
        ),
        r.organization_id,
        e.learner_id,
        e.course_id,
      );
      const eligible = this.assessmentEligible(snapshot);
      await this.repository.prisma.$transaction(
        async (tx) => {
          const current = await this.repository.enrollment(r, tx, true);
          const [request] = await tx.$queryRaw<
            { generation: bigint }[]
          >`SELECT generation FROM completion_evaluation_requests
          WHERE enrollment_id=${r.enrollment_id}::uuid AND organization_id=${r.organization_id}::uuid FOR UPDATE`;
          if (!request || request.generation !== r.generation) {
            this.metrics.generationDiscarded++;
            return;
          }
          if (
            !current ||
            !allowed(current.status) ||
            current.disabled_at !== null
          ) {
            await this.repository.remove(r, tx);
            return;
          }
          const materials = await this.repository.materials(
            r,
            current.course_id,
            tx,
          );
          if (!materials.ready) {
            await this.repository.remove(r, tx);
            return;
          }
          if (materials.required + snapshot.requiredComponentCount === 0) {
            this.logger.warn('COMPLETION_EMPTY_REQUIREMENTS');
            await this.repository.remove(r, tx);
            return;
          }
          if (!eligible) {
            await this.repository.remove(r, tx);
            return;
          }
          const [{ completedAt }] = await tx.$queryRaw<
            { completedAt: Date }[]
          >`SELECT clock_timestamp() AS "completedAt"`;
          // BR-150/151: close before recomputing the union, never add pauses repeatedly.
          await tx.$executeRaw`UPDATE enrollment_status_intervals SET ended_at=GREATEST(started_at,clock_timestamp()),updated_at=clock_timestamp()
          WHERE enrollment_id=${r.enrollment_id}::uuid AND organization_id=${r.organization_id}::uuid AND kind='Exempted' AND ended_at IS NULL`;
          // Preserve microseconds in CHECK operands by computing and storing the deadline in SQL.
          const [deadline] = await tx.$queryRaw<
            { dueAt: Date | null; completedLate: boolean }[]
          >`
          WITH pauses AS (
            SELECT greatest(i.started_at,e.assigned_at) AS start_at,i.ended_at AS end_at
            FROM enrollment_status_intervals i JOIN enrollments e ON e.id=i.enrollment_id AND e.organization_id=i.organization_id
            WHERE e.id=${r.enrollment_id}::uuid AND i.ended_at IS NOT NULL AND i.ended_at>e.assigned_at
            UNION ALL
            SELECT greatest(s.started_at,e.assigned_at),s.ended_at FROM organization_suspensions s JOIN enrollments e ON e.organization_id=s.organization_id
            WHERE e.id=${r.enrollment_id}::uuid AND s.ended_at IS NOT NULL AND s.ended_at>e.assigned_at
          ), merged AS (SELECT range_agg(tstzrange(start_at,end_at,'[)')) AS spans FROM pauses WHERE end_at>start_at),
          effective AS (SELECT e.enrollment_type,e.base_due_at+e.extension_seconds*interval '1 second'+
            COALESCE((SELECT sum(upper(p)-lower(p)) FROM merged,unnest(spans) p),interval '0 seconds') AS due_at
            FROM enrollments e WHERE e.id=${r.enrollment_id}::uuid)
          UPDATE enrollments e SET status='Completed',completed_at=${completedAt},
          completed_late=CASE WHEN effective.enrollment_type='Required' THEN
            COALESCE(effective.due_at<=${completedAt} AND NOT EXISTS(
              SELECT 1 FROM organization_suspensions s WHERE s.organization_id=${r.organization_id}::uuid
                AND s.ended_at IS NULL AND s.started_at<effective.due_at),false) ELSE NULL END,
          due_at=effective.due_at,completion_snapshot=${JSON.stringify(snapshot)}::jsonb,updated_at=${completedAt}
          FROM effective WHERE e.id=${r.enrollment_id}::uuid AND e.organization_id=${r.organization_id}::uuid AND e.status=${current.status}
          RETURNING e.due_at AS "dueAt",e.completed_late AS "completedLate"`;
          if (!deadline) throw new Error('COMPLETION_TRANSACTION_FAILED');
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'Enrollment',
              aggregateId: r.enrollment_id,
              organizationId: r.organization_id,
              eventType: 'EnrollmentCompleted',
              occurredAt: completedAt,
              payload: {
                enrollmentId: r.enrollment_id,
                organizationId: r.organization_id,
                learnerId: current.learner_id,
                courseId: current.course_id,
                enrollmentType: current.enrollment_type,
                completedAt: completedAt.toISOString(),
                dueAt: deadline.dueAt?.toISOString() ?? null,
                completedLate:
                  current.enrollment_type === 'Required'
                    ? deadline.completedLate
                    : false,
                scoreSnapshot: JSON.parse(
                  JSON.stringify(snapshot),
                ) as Prisma.InputJsonValue,
                occurredAt: completedAt.toISOString(),
              },
            },
          });
          this.affected(await this.repository.remove(r, tx));
        },
        { timeout: this.repository.config.transactionMs },
      );
    } catch (error) {
      const code =
        error instanceof CompletionClientError
          ? error.code
          : 'COMPLETION_TRANSACTION_FAILED';
      if (error instanceof CompletionClientError)
        this.logger.error({
          code,
          httpStatus: error.httpStatus ?? null,
          permanent:
            code === 'INVALID_SNAPSHOT' ||
            [400, 401, 403, 404, 422].includes(error.httpStatus ?? 0),
        });
      else this.logger.warn({ code, ...transactionFailureDetails(error) });
      this.affected(await this.repository.retry(r, code));
    }
  }
}

function transactionFailureDetails(error: unknown) {
  const root = error as { code?: unknown } | null;
  const errorCode =
    typeof root?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(root.code)
      ? root.code
      : 'UNKNOWN';
  let constraint: string | null = null;
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || depth > 6) return;
    const row = value as Record<string, unknown>;
    if (
      typeof row.constraint === 'string' &&
      /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(row.constraint)
    )
      constraint = row.constraint;
    for (const key of ['message', 'originalMessage']) {
      if (typeof row[key] === 'string') {
        const match = row[key].match(
          /constraint "([a-zA-Z_][a-zA-Z0-9_]{0,62})"/,
        );
        if (match) constraint = match[1];
      }
    }
    for (const key of ['meta', 'cause', 'driverAdapterError'])
      visit(row[key], depth + 1);
  };
  visit(error, 0);
  return { errorCode, constraint };
}
