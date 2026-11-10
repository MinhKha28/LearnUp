import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { COMPLETION_CONFIG, type CompletionConfig } from './completion.config';

export interface CompletionRequest {
  enrollment_id: string;
  organization_id: string;
  generation: bigint;
  attempts: bigint;
  expired: boolean;
}
export const claimCompletionSql = (
  limit: number,
  leaseMs: number,
) => Prisma.sql`
  WITH candidates AS (
    SELECT id,last_error='LEASED' AS expired FROM completion_evaluation_requests
    WHERE next_attempt_at <= clock_timestamp() ORDER BY next_attempt_at,id LIMIT ${limit} FOR UPDATE SKIP LOCKED
  ) UPDATE completion_evaluation_requests r SET generation=r.generation+1,
    next_attempt_at=clock_timestamp()+${leaseMs}*interval '1 millisecond',last_error='LEASED',updated_at=clock_timestamp()
    FROM candidates c WHERE r.id=c.id RETURNING r.*,COALESCE(c.expired,false) AS expired`;

export const completionMaterialsSql = (
  org: string,
  course: string,
  enrollment: string,
) => Prisma.sql`
  SELECT count(*)::integer AS required,
    NOT EXISTS (SELECT 1 FROM material_snapshots m
      WHERE m.organization_id=${org}::uuid AND m.course_id=${course}::uuid AND m.is_required AND m.disabled_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM lesson_snapshots l WHERE l.lesson_id=m.lesson_id AND l.organization_id=m.organization_id AND l.disabled_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM material_progress p WHERE p.enrollment_id=${enrollment}::uuid AND p.organization_id=m.organization_id AND p.material_id=m.material_id AND p.completed_at IS NOT NULL)) AS ready
  FROM material_snapshots m WHERE m.organization_id=${org}::uuid AND m.course_id=${course}::uuid AND m.is_required AND m.disabled_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM lesson_snapshots l WHERE l.lesson_id=m.lesson_id AND l.organization_id=m.organization_id AND l.disabled_at IS NOT NULL)`;

@Injectable()
export class CompletionRepository {
  constructor(
    readonly prisma: PrismaService,
    @Inject(COMPLETION_CONFIG) readonly config: CompletionConfig,
  ) {}
  claim(limit = Math.min(this.config.batchSize, this.config.concurrency)) {
    return this.prisma.$transaction(
      (tx) =>
        tx.$queryRaw<CompletionRequest[]>(
          claimCompletionSql(
            Math.min(limit, this.config.batchSize, this.config.concurrency),
            this.config.leaseMs,
          ),
        ),
      { timeout: this.config.transactionMs },
    );
  }
  async remove(
    r: CompletionRequest,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.$executeRaw`DELETE FROM completion_evaluation_requests WHERE enrollment_id=${r.enrollment_id}::uuid AND organization_id=${r.organization_id}::uuid AND generation=${r.generation}`;
  }
  async retry(r: CompletionRequest, code: string) {
    const delay = Math.min(
      this.config.backoffMaxMs,
      this.config.backoffMs * 2 ** Number(r.attempts > 30n ? 30n : r.attempts),
    );
    return this.prisma
      .$executeRaw`UPDATE completion_evaluation_requests SET attempts=attempts+1,last_error=${code},
      next_attempt_at=clock_timestamp()+${delay}*interval '1 millisecond',updated_at=clock_timestamp()
      WHERE enrollment_id=${r.enrollment_id}::uuid AND organization_id=${r.organization_id}::uuid AND generation=${r.generation}`;
  }
  async enrollment(
    r: CompletionRequest,
    tx: Prisma.TransactionClient = this.prisma,
    lock = false,
  ) {
    const rows = await tx.$queryRaw<
      {
        id: string;
        status: string;
        learner_id: string;
        course_id: string;
        enrollment_type: string;
        disabled_at: Date | null;
      }[]
    >(Prisma.sql`
      SELECT e.id,e.status,e.learner_id,e.course_id,e.enrollment_type,c.disabled_at FROM enrollments e JOIN course_version_snapshots c
        ON c.course_id=e.course_id AND c.organization_id=e.organization_id
      WHERE e.id=${r.enrollment_id}::uuid AND e.organization_id=${r.organization_id}::uuid ${lock ? Prisma.sql`FOR UPDATE OF e` : Prisma.empty}`);
    return rows[0];
  }
  async materials(
    r: CompletionRequest,
    course: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return (
      await tx.$queryRaw<{ required: number; ready: boolean }[]>(
        completionMaterialsSql(r.organization_id, course, r.enrollment_id),
      )
    )[0];
  }
  async metrics() {
    return (
      await this.prisma.$queryRaw<
        { pending: number; oldest_seconds: number }[]
      >`SELECT count(*)::integer AS pending,
      COALESCE(extract(epoch FROM clock_timestamp()-min(created_at)),0)::double precision AS oldest_seconds FROM completion_evaluation_requests`
    )[0];
  }
}
