import { Prisma } from '../../generated/prisma/client';

const SQL_ALIAS = /^[a-z_][a-z0-9_]*$/;

/**
 * Trạng thái hiển thị của Enrollment (D23, thiết kế 3.1.2), dùng chung cho UC26, UC27 và báo cáo:
 * Overdue khi Required, NotStarted/InProgress, due_at <= now() của DB và không có lần tạm khóa
 * tổ chức nào đang mở bắt đầu trước due_at (BR-144); ngược lại là status đã lưu.
 * `alias` là alias của bảng enrollments trong câu truy vấn gọi.
 */
export function enrollmentDisplayStatusSql(alias: string): Prisma.Sql {
  if (!SQL_ALIAS.test(alias)) {
    throw new Error(`Alias SQL không hợp lệ: "${alias}".`);
  }
  const e = Prisma.raw(alias);
  return Prisma.sql`CASE
    WHEN ${e}.enrollment_type = 'Required'
      AND ${e}.status IN ('NotStarted', 'InProgress')
      AND ${e}.due_at <= now()
      AND NOT EXISTS (
        SELECT 1 FROM organization_suspensions s
         WHERE s.organization_id = ${e}.organization_id
           AND s.ended_at IS NULL
           AND s.started_at < ${e}.due_at)
    THEN 'Overdue'
    ELSE ${e}.status
  END`;
}
