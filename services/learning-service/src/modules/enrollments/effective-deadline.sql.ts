import { Prisma } from '../../../generated/prisma/client';

/** Rebuild a deadline from closed pauses without counting overlaps twice. */
export function effectiveDeadlineCtes(
  enrollmentId: string,
  organizationId: string,
) {
  return Prisma.sql`
    pauses AS (
      SELECT greatest(i.started_at,e.assigned_at) AS start_at,i.ended_at AS end_at
      FROM enrollment_status_intervals i JOIN enrollments e
        ON e.id=i.enrollment_id AND e.organization_id=i.organization_id
      WHERE e.id=${enrollmentId}::uuid AND e.organization_id=${organizationId}::uuid
        AND i.ended_at IS NOT NULL AND i.ended_at>e.assigned_at
      UNION ALL
      SELECT greatest(s.started_at,e.assigned_at),s.ended_at
      FROM organization_suspensions s JOIN enrollments e ON e.organization_id=s.organization_id
      WHERE e.id=${enrollmentId}::uuid AND e.organization_id=${organizationId}::uuid
        AND s.ended_at IS NOT NULL AND s.ended_at>e.assigned_at
    ), merged AS (
      SELECT range_agg(tstzrange(start_at,end_at,'[)')) AS spans FROM pauses WHERE end_at>start_at
    ), effective AS (
      SELECT e.enrollment_type,e.base_due_at+e.extension_seconds*interval '1 second'+
        COALESCE((SELECT sum(upper(p)-lower(p)) FROM merged,unnest(spans) p),interval '0 seconds') AS due_at
      FROM enrollments e WHERE e.id=${enrollmentId}::uuid AND e.organization_id=${organizationId}::uuid
    )`;
}
