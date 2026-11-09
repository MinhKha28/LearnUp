import type { Prisma } from '../../../generated/prisma/client';

import type { ManagedCourseChainDto } from './dto/managed-course-chain.dto';

/**
 * Quyền phụ trách Course gắn với cả chuỗi phiên bản (BR-287: course_chains.instructor_id); đổi người phụ trách
 * là đổi một cột trên course_chains nên mọi phiên bản của chuỗi đi theo. Các hàm nhận client của transaction
 * để UC12.5 (chuyển hết chuỗi) và UC23 (chuyển một chuỗi) dùng chung.
 */

export type CourseChainTransferResult =
  | 'TRANSFERRED'
  | 'NOT_FOUND' // chuỗi không tồn tại hoặc thuộc tổ chức khác
  | 'NOT_OWNER' // chuỗi không còn do fromInstructorId phụ trách (đã chuyển rồi)
  | 'ALREADY_OWNER'; // chuỗi đã do toInstructorId phụ trách

export interface CourseChainTransferInput {
  organizationId: string;
  chainId: string;
  toInstructorId: string;
  /** Có thì chỉ chuyển khi chuỗi vẫn do người này phụ trách (kiểm dưới khóa dòng). */
  fromInstructorId?: string;
}

interface RepresentativeRow {
  chain_id: string;
  course_id: string;
  name: string;
  version_number: number;
  status: string;
  course_type: string;
  published_at: Date | null;
}

/**
 * Lõi "chuyển 1 chuỗi": khóa dòng course_chains rồi kiểm lại chủ sở hữu, nên hai lần chuyển cùng chuỗi chạy
 * song song thì lần sau thấy NOT_OWNER / ALREADY_OWNER thay vì ghi đè. Không kiểm trạng thái tài khoản và không
 * ghi audit / gửi thư: bên gọi lo. Phải gọi trong transaction để khóa giữ tới lúc commit.
 */
export async function transferCourseChain(
  tx: Prisma.TransactionClient,
  input: CourseChainTransferInput,
): Promise<CourseChainTransferResult> {
  const toInstructorId = input.toInstructorId.toLowerCase();
  const rows = await tx.$queryRaw<{ instructor_id: string }[]>`
    SELECT instructor_id::text AS instructor_id
    FROM course_chains
    WHERE id = ${input.chainId}::uuid
      AND organization_id = ${input.organizationId}::uuid
    FOR UPDATE`;
  const chain = rows[0];
  if (!chain) return 'NOT_FOUND';
  if (chain.instructor_id === toInstructorId) return 'ALREADY_OWNER';
  if (
    input.fromInstructorId &&
    chain.instructor_id !== input.fromInstructorId.toLowerCase()
  ) {
    return 'NOT_OWNER';
  }

  await tx.$executeRaw`
    UPDATE course_chains
    SET instructor_id = ${toInstructorId}::uuid, updated_at = now()
    WHERE id = ${input.chainId}::uuid
      AND organization_id = ${input.organizationId}::uuid`;
  return 'TRANSFERRED';
}

/** Chuỗi có ít nhất một phiên bản mà Instructor phụ trách; không lọc Archived (giống count-by-instructors). */
export async function findManagedChains(
  db: Prisma.TransactionClient,
  organizationId: string,
  instructorId: string,
): Promise<ManagedCourseChainDto[]> {
  const rows = await db.$queryRaw<RepresentativeRow[]>`
    SELECT DISTINCT ON (c.chain_id)
           c.chain_id::text AS chain_id, c.id::text AS course_id, c.name,
           c.version_number, c.status, c.course_type, c.published_at
    FROM courses c
    JOIN course_chains ch ON ch.id = c.chain_id
    WHERE ch.organization_id = ${organizationId}::uuid
      AND ch.instructor_id = ${instructorId}::uuid
      AND c.organization_id = ${organizationId}::uuid
    ORDER BY c.chain_id, c.published_at DESC NULLS LAST, c.version_number DESC`;
  return toManagedChains(rows);
}

/** Phiên bản đại diện của các chuỗi cho trước (chỉ trong tổ chức); chuỗi không còn phiên bản nào thì bỏ qua. */
export async function findChainRepresentatives(
  db: Prisma.TransactionClient,
  organizationId: string,
  chainIds: string[],
): Promise<ManagedCourseChainDto[]> {
  if (chainIds.length === 0) return [];
  const rows = await db.$queryRaw<RepresentativeRow[]>`
    SELECT DISTINCT ON (c.chain_id)
           c.chain_id::text AS chain_id, c.id::text AS course_id, c.name,
           c.version_number, c.status, c.course_type, c.published_at
    FROM courses c
    WHERE c.organization_id = ${organizationId}::uuid
      AND c.chain_id = ANY(${chainIds}::uuid[])
    ORDER BY c.chain_id, c.published_at DESC NULLS LAST, c.version_number DESC`;
  return toManagedChains(rows);
}

// Sắp theo tên rồi chainId để danh sách hiển thị ổn định giữa các lần gọi
function toManagedChains(rows: RepresentativeRow[]): ManagedCourseChainDto[] {
  return rows
    .map((row) => ({
      chainId: row.chain_id,
      courseId: row.course_id,
      name: row.name,
      versionNumber: row.version_number,
      status: row.status,
      courseType: row.course_type,
      approvedAt: row.published_at,
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.chainId.localeCompare(b.chainId),
    );
}
