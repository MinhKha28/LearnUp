import type { Prisma } from '../../../../generated/prisma/client';

export interface OutboxRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  organization_id: string | null;
  payload: Prisma.JsonValue;
  occurred_at: Date;
  attempts: number;
}
