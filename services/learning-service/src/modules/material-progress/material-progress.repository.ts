import { randomUUID } from 'node:crypto';
import { requestCompletion } from '../course-completion/completion-request';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { WatchedRange } from './video-progress.rules';
import { enrollmentDisplayStatusSql } from '../enrollments/enrollment-display-status.sql';
import { buildCurriculum } from '../curriculum/build-curriculum';

export interface ProgressAccess {
  id: string;
  courseId: string;
  status: string;
  videoCompletionPercent: number;
  disabledAt: Date | null;
}
export interface ProgressRow {
  watchedRanges: WatchedRange[];
  watchedSeconds: number;
  completedAt: Date | null;
  lastReportedAt: Date | null;
  positionSeconds: number | null;
  positionReportedAt: Date | null;
}
export interface ProgressPreview extends ProgressRow {
  newSeconds: number;
  now: Date;
}

export const progressAccessSql = (
  enrollmentId: string,
  learnerId: string,
  organizationId: string,
  lock = false,
) => Prisma.sql`
  SELECT e.id, e.course_id AS "courseId", e.status,
         e.video_completion_percent AS "videoCompletionPercent", c.disabled_at AS "disabledAt"
    FROM enrollments e JOIN course_version_snapshots c
      ON c.course_id=e.course_id AND c.organization_id=e.organization_id
   WHERE e.id=${enrollmentId}::uuid AND e.learner_id=${learnerId}::uuid AND e.organization_id=${organizationId}::uuid
   ${lock ? Prisma.sql`FOR UPDATE OF e` : Prisma.empty}`;

const rangesJson = (value: Prisma.Sql) =>
  Prisma.sql`COALESCE((SELECT jsonb_agg(jsonb_build_array(lower(r),upper(r)) ORDER BY lower(r)) FROM unnest(${value}) r),'[]'::jsonb)`;
const seconds = (value: Prisma.Sql) =>
  Prisma.sql`COALESCE((SELECT sum(upper(r)-lower(r)) FROM unnest(${value}) r),0)::integer`;
const rangesValue = (ranges: WatchedRange[]) =>
  Prisma.sql`${'{' + ranges.map(([s, e]) => `[${s},${e})`).join(',') + '}'}::int4multirange`;

export const lockProgressSql = (
  enrollmentId: string,
  materialId: string,
  organizationId: string,
) => Prisma.sql`
  SELECT ${rangesJson(Prisma.sql`watched_ranges`)} AS "watchedRanges",
         ${seconds(Prisma.sql`watched_ranges`)} AS "watchedSeconds",
         completed_at AS "completedAt", last_reported_at AS "lastReportedAt",
         position_seconds AS "positionSeconds", position_reported_at AS "positionReportedAt"
    FROM material_progress WHERE enrollment_id=${enrollmentId}::uuid AND material_id=${materialId}::uuid
     AND organization_id=${organizationId}::uuid FOR UPDATE`;

export const previewProgressSql = (
  enrollmentId: string,
  materialId: string,
  organizationId: string,
  ranges: WatchedRange[],
) => Prisma.sql`
  WITH proposed AS (
    SELECT COALESCE(watched_ranges,'{}'::int4multirange) + ${rangesValue(ranges)} AS merged,
           ${rangesValue(ranges)} - COALESCE(watched_ranges,'{}'::int4multirange) AS novel,
           completed_at, last_reported_at, position_seconds, position_reported_at
      FROM material_progress WHERE enrollment_id=${enrollmentId}::uuid AND material_id=${materialId}::uuid
       AND organization_id=${organizationId}::uuid)
  SELECT ${rangesJson(Prisma.sql`merged`)} AS "watchedRanges", ${seconds(Prisma.sql`merged`)} AS "watchedSeconds",
         ${seconds(Prisma.sql`novel`)} AS "newSeconds", completed_at AS "completedAt",
          last_reported_at AS "lastReportedAt", position_seconds AS "positionSeconds",
          position_reported_at AS "positionReportedAt", clock_timestamp() AS "now" FROM proposed`;

export const activateEnrollmentSql = (
  enrollmentId: string,
  organizationId: string,
  now: Date,
) => Prisma.sql`
  UPDATE enrollments SET status=CASE WHEN status='NotStarted' THEN 'InProgress' ELSE status END,
    first_activity_at=LEAST(COALESCE(first_activity_at,${now}::timestamptz),${now}::timestamptz), updated_at=${now}::timestamptz
   WHERE id=${enrollmentId}::uuid AND organization_id=${organizationId}::uuid
     AND status IN ('NotStarted','InProgress','Exempted')`;

@Injectable()
export class MaterialProgressRepository {
  constructor(private readonly prisma: PrismaService) {}
  transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(work);
  }
  async completeReading(
    enrollmentId: string,
    materialId: string,
    org: string,
    tx: Prisma.TransactionClient,
  ) {
    const rows = await tx.$queryRaw<{ completedAt: Date }[]>`
      INSERT INTO material_progress AS p(id,organization_id,enrollment_id,material_id,completed_at,watched_ranges)
      VALUES (${randomUUID()}::uuid,${org}::uuid,${enrollmentId}::uuid,${materialId}::uuid,clock_timestamp(),NULL)
      ON CONFLICT (enrollment_id,material_id) DO UPDATE
        SET completed_at=EXCLUDED.completed_at,updated_at=EXCLUDED.completed_at
        WHERE p.organization_id=EXCLUDED.organization_id AND p.completed_at IS NULL
      RETURNING completed_at AS "completedAt"`;
    if (!rows.length) return false;
    await tx.$executeRaw(
      activateEnrollmentSql(enrollmentId, org, rows[0].completedAt),
    );
    await requestCompletion(tx, org, enrollmentId, 'READING_COMPLETED');
    return true;
  }
  async readingState(
    enrollmentId: string,
    materialId: string,
    courseId: string,
    lessonId: string,
    org: string,
    tx: Prisma.TransactionClient,
  ) {
    const materials = await tx.materialSnapshot.findMany({
      where: { courseId, lessonId, organizationId: org },
    });
    const disabled = await this.disabledLesson(lessonId, org, tx);
    const completed = await tx.materialProgress.findMany({
      where: { enrollmentId, organizationId: org, completedAt: { not: null } },
    });
    // Snapshot-only adapter: completion has no dependency on course-service (BR-185/186).
    const curriculum = buildCurriculum(
      {
        courseId,
        chainId: courseId,
        versionNumber: 0,
        disabledAt: null,
        asOf: new Date(),
        modules: [
          {
            id: courseId,
            title: '',
            position: 0,
            lessons: [
              {
                id: lessonId,
                title: '',
                position: 0,
                disabledAt: disabled ? new Date(0) : null,
                materials: materials.map((m, position) => ({
                  id: m.materialId,
                  title: '',
                  position,
                  materialType: m.materialType as 'Video' | 'Reading',
                  isRequired: m.isRequired,
                  durationSeconds: m.durationSeconds,
                  disabledAt: m.disabledAt,
                })),
              },
            ],
          },
        ],
      },
      { materials, disabledLessonIds: new Set(disabled ? [lessonId] : []) },
      new Set(completed.map((m) => m.materialId)),
    );
    const [state] = await tx.$queryRaw<{ status: string; pending: boolean }[]>`
      SELECT ${enrollmentDisplayStatusSql('e')} AS status,
        EXISTS(SELECT 1 FROM completion_evaluation_requests r WHERE r.enrollment_id=e.id AND r.organization_id=e.organization_id) AS pending
      FROM enrollments e WHERE e.id=${enrollmentId}::uuid AND e.organization_id=${org}::uuid`;
    return {
      materialId,
      completedAt:
        completed
          .find((m) => m.materialId === materialId)
          ?.completedAt?.toISOString() ?? null,
      lessonCompleted: curriculum.visibleLessons[0]?.completed ?? null,
      enrollmentStatus: state.status,
      completionEvaluationPending: state.pending,
    };
  }
  async access(
    enrollmentId: string,
    learnerId: string,
    org: string,
    tx?: Prisma.TransactionClient,
  ) {
    const rows = await (tx ?? this.prisma).$queryRaw<ProgressAccess[]>(
      progressAccessSql(enrollmentId, learnerId, org, !!tx),
    );
    return rows[0] ?? null;
  }
  material(
    materialId: string,
    courseId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).materialSnapshot.findFirst({
      where: { materialId, courseId, organizationId },
    });
  }
  async disabledLesson(
    lessonId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return !!(await (tx ?? this.prisma).lessonSnapshot.findFirst({
      where: { lessonId, organizationId, disabledAt: { not: null } },
    }));
  }
  async insertSnapshot(
    data: Prisma.MaterialSnapshotCreateManyInput,
    tx: Prisma.TransactionClient,
  ) {
    await tx.materialSnapshot.createMany({
      data: [data],
      skipDuplicates: true,
    });
  }
  async read(
    enrollmentId: string,
    materialId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ProgressRow> {
    const rows = await (tx ?? this.prisma).$queryRaw<ProgressRow[]>`
      SELECT ${rangesJson(Prisma.sql`watched_ranges`)} AS "watchedRanges", ${seconds(Prisma.sql`watched_ranges`)} AS "watchedSeconds",
             completed_at AS "completedAt", last_reported_at AS "lastReportedAt",
             position_seconds AS "positionSeconds", position_reported_at AS "positionReportedAt"
        FROM material_progress WHERE enrollment_id=${enrollmentId}::uuid AND material_id=${materialId}::uuid AND organization_id=${organizationId}::uuid`;
    return (
      rows[0] ?? {
        watchedRanges: [],
        watchedSeconds: 0,
        completedAt: null,
        lastReportedAt: null,
        positionSeconds: null,
        positionReportedAt: null,
      }
    );
  }
  async lock(
    enrollmentId: string,
    materialId: string,
    organizationId: string,
    tx: Prisma.TransactionClient,
  ): Promise<ProgressRow> {
    await tx.$executeRaw`INSERT INTO material_progress(id,organization_id,enrollment_id,material_id,watched_ranges)
      VALUES (${randomUUID()}::uuid,${organizationId}::uuid,${enrollmentId}::uuid,${materialId}::uuid,'{}'::int4multirange)
      ON CONFLICT (enrollment_id,material_id) DO NOTHING`;
    const [row] = await tx.$queryRaw<ProgressRow[]>(
      lockProgressSql(enrollmentId, materialId, organizationId),
    );
    return row;
  }
  async preview(
    enrollmentId: string,
    materialId: string,
    org: string,
    ranges: WatchedRange[],
    tx: Prisma.TransactionClient,
  ) {
    const [row] = await tx.$queryRaw<ProgressPreview[]>(
      previewProgressSql(enrollmentId, materialId, org, ranges),
    );
    return row;
  }
  async save(
    enrollmentId: string,
    materialId: string,
    org: string,
    row: ProgressPreview,
    required: number,
    ranges: WatchedRange[],
    tx: Prisma.TransactionClient,
  ): Promise<ProgressRow> {
    const completedAt =
      row.completedAt ?? (row.watchedSeconds >= required ? row.now : null);
    await tx.$executeRaw`UPDATE material_progress
      SET watched_ranges=COALESCE(watched_ranges,'{}'::int4multirange)+${rangesValue(ranges)},
          completed_at=COALESCE(completed_at,${completedAt}::timestamptz),
          last_reported_at=${row.now}::timestamptz, updated_at=${row.now}::timestamptz
      WHERE enrollment_id=${enrollmentId}::uuid AND material_id=${materialId}::uuid AND organization_id=${org}::uuid`;
    if (row.completedAt === null && completedAt !== null) {
      await tx.$executeRaw(activateEnrollmentSql(enrollmentId, org, row.now));
      await requestCompletion(tx, org, enrollmentId, 'VIDEO_COMPLETED');
    }
    return { ...row, completedAt };
  }
  async savePosition(
    enrollmentId: string,
    materialId: string,
    org: string,
    position: number,
    reportedAt: Date,
    tx: Prisma.TransactionClient,
  ): Promise<ProgressRow> {
    await tx.$executeRaw`UPDATE material_progress
      SET position_seconds=${position}, position_reported_at=${reportedAt}::timestamptz
      WHERE enrollment_id=${enrollmentId}::uuid AND material_id=${materialId}::uuid AND organization_id=${org}::uuid
        AND (position_reported_at IS NULL OR position_reported_at < ${reportedAt}::timestamptz)`;
    return this.read(enrollmentId, materialId, org, tx);
  }
}
