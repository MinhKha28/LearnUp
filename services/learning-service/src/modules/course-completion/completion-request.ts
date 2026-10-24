import { Prisma } from '../../../generated/prisma/client';
import { randomUUID } from 'node:crypto';

export type CompletionSource =
  | 'VIDEO_COMPLETED'
  | 'READING_COMPLETED'
  | 'ASSIGNMENT_CONVERT'
  | 'ASSIGNMENT_RESTORE'
  | 'OPTIONAL_RESTORE';

/** Enqueue within the trigger transaction. A new signal deliberately bypasses backoff. */
export async function requestCompletion(
  tx: Prisma.TransactionClient,
  organizationId: string,
  enrollmentId: string,
  source: CompletionSource,
): Promise<void> {
  await tx.$executeRaw`INSERT INTO completion_evaluation_requests(id,organization_id,enrollment_id,source)
    VALUES (${randomUUID()}::uuid,${organizationId}::uuid,${enrollmentId}::uuid,${source})
    ON CONFLICT (enrollment_id) DO UPDATE SET generation=completion_evaluation_requests.generation+1,
      source=EXCLUDED.source,last_error=NULL,requested_at=clock_timestamp(),next_attempt_at=clock_timestamp(),updated_at=clock_timestamp()`;
}
