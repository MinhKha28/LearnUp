import { UserRoleValue } from '../../common/constants/tenant.constants';
import type { SeatRole } from '../users/users.service';

const MIB = 1024 * 1024;

/**
 * Giới hạn cấu hình (không phải tham số nghiệp vụ): ghi đè bằng IMPORT_MAX_FILE_BYTES / IMPORT_MAX_ROWS.
 * Multer chặn ở MULTER_CEILING_BYTES ngay khi nhận; service kiểm lại theo giá trị cấu hình.
 */
export const DEFAULT_IMPORT_MAX_FILE_BYTES = 1 * MIB;
export const DEFAULT_IMPORT_MAX_ROWS = 500;
export const IMPORT_MULTER_CEILING_BYTES = 5 * MIB;

/** Thời gian tối đa của transaction confirm (mặc định của Prisma là 5 giây, không đủ cho 500 dòng). */
export const IMPORT_TRANSACTION_TIMEOUT_MS = 30_000;
export const IMPORT_TRANSACTION_MAX_WAIT_MS = 10_000;

/** Loại hành động ghi audit (Kiến trúc: "member import" là hành động cần audit). */
export const MEMBER_IMPORTED_ACTION = 'MEMBER_IMPORTED';

export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type ImportField = 'fullName' | 'email' | 'department' | 'role';

/** Tiêu đề cột của tệp mẫu, theo thứ tự cột A..D. */
export const IMPORT_COLUMNS: ReadonlyArray<{
  field: ImportField;
  header: string;
  required: boolean;
  width: number;
}> = [
  { field: 'fullName', header: 'Họ tên', required: true, width: 32 },
  { field: 'email', header: 'Email', required: true, width: 36 },
  {
    field: 'department',
    header: 'Đơn vị công tác',
    required: false,
    width: 28,
  },
  { field: 'role', header: 'Vai trò', required: true, width: 16 },
];

/**
 * Tên cột chấp nhận khi đọc tệp (so sau khi chuẩn hóa: NFC, trim, chữ thường, bỏ dấu "*").
 * Cho phép thêm tên tiếng Anh để tệp do người dùng tự soạn vẫn đọc được.
 */
export const HEADER_ALIASES: Record<ImportField, readonly string[]> = {
  fullName: ['họ tên', 'họ và tên', 'full name', 'fullname'],
  email: ['email', 'e-mail'],
  department: ['đơn vị công tác', 'đơn vị', 'department'],
  role: ['vai trò', 'role'],
};

/** Nhãn trường dùng trong lý do lỗi. */
export const FIELD_LABEL: Record<ImportField, string> = {
  fullName: 'Họ tên',
  email: 'Email',
  department: 'Đơn vị công tác',
  role: 'Vai trò',
};

/** BR-34: vai trò khai trong tệp phải đúng role của lần import (UC12.8 Instructor, UC13.8 Learner). */
export const ROLE_CELL_VALUE: Record<SeatRole, string> = {
  [UserRoleValue.Instructor]: 'Instructor',
  [UserRoleValue.Learner]: 'Learner',
};

/** Mã lỗi theo từng dòng (BR-34). Frontend đổi mã thành thông báo hiển thị. */
export const ImportRowErrorCode = {
  MissingRequiredField: 'MISSING_REQUIRED_FIELD',
  InvalidEmail: 'INVALID_EMAIL',
  DuplicateEmailInFile: 'DUPLICATE_EMAIL_IN_FILE',
  EmailAlreadyUsed: 'EMAIL_ALREADY_USED',
  InvalidRole: 'INVALID_ROLE',
  InvalidValue: 'INVALID_VALUE',
} as const;

export type ImportRowErrorCodeValue =
  (typeof ImportRowErrorCode)[keyof typeof ImportRowErrorCode];
