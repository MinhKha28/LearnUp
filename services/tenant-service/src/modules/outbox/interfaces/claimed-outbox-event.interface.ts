import type { Prisma } from '../../../../generated/prisma/client';

/** Event đã được khóa để gửi; attempts là số lần đã thử trước lần này. */
export interface IClaimedOutboxEvent {
  id: string;
  payload: Prisma.JsonValue;
  attempts: number;
}
