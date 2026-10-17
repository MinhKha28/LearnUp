import { Prisma } from '../../../generated/prisma/client';

/** BR-305: khôi phục trạng thái theo thời điểm hoạt động đầu tiên. */
export function enrollmentRestoredStatusSql(
  firstActivityAt: Prisma.Sql,
): Prisma.Sql {
  return Prisma.sql`CASE WHEN ${firstActivityAt} IS NULL THEN 'NotStarted' ELSE 'InProgress' END`;
}
