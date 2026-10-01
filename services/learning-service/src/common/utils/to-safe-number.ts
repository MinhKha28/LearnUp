/**
 * Đổi bigint từ Prisma (cột bigint) sang number ở lớp ánh xạ.
 * Ném lỗi thay vì làm tròn âm thầm khi vượt Number.MAX_SAFE_INTEGER.
 */
export function toSafeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(
      `Giá trị bigint ${value.toString()} vượt phạm vi số nguyên an toàn của JavaScript.`,
    );
  }
  return result;
}
