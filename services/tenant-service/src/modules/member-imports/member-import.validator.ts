import { createHash } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { normalizeEmail, normalizeText } from '../../common/utils/text.util';
import { CreateAccountDto } from '../users/dto/create-account.dto';
import type { SeatRole } from '../users/users.service';
import {
  FIELD_LABEL,
  ImportRowErrorCode,
  ROLE_CELL_VALUE,
  type ImportField,
} from './member-import.constants';
import type {
  IImportRowError,
  IInvalidImportRow,
  IRawImportRow,
  IValidImportRow,
} from './interfaces/member-import.interface';

/** Dòng đã kiểm định dạng (chưa kiểm email trùng trên nền tảng). */
export interface ICheckedImportRow {
  raw: IRawImportRow;
  normalized: IValidImportRow;
  errors: IImportRowError[];
}

const DTO_FIELDS: ImportField[] = ['fullName', 'email', 'department'];

function rowError(
  field: ImportField,
  code: IImportRowError['code'],
  message: string,
): IImportRowError {
  return { field, code, message };
}

/**
 * BR-34 (phần không cần DB): thiếu trường bắt buộc, email sai định dạng, vai trò khai không hợp lệ,
 * email trùng với dòng khác trong cùng tệp. Quy tắc độ dài / ký tự lấy đúng CreateAccountDto của UC12.2.
 * Email so trùng sau chuẩn hóa NFC + trim + chữ thường.
 */
export function checkImportRows(
  rows: IRawImportRow[],
  role: SeatRole,
): ICheckedImportRow[] {
  const expectedRole = ROLE_CELL_VALUE[role];

  const checked = rows.map((raw): ICheckedImportRow => {
    const errors: IImportRowError[] = [];
    const missing = new Set<ImportField>();
    for (const field of ['fullName', 'email', 'role'] as const) {
      if (raw[field].trim() === '') {
        missing.add(field);
        errors.push(
          rowError(
            field,
            ImportRowErrorCode.MissingRequiredField,
            `Thiếu ${FIELD_LABEL[field]}.`,
          ),
        );
      }
    }

    // Cùng @Transform + quy tắc của CreateAccountDto (UC12.2) nên dòng import và thêm tay cho cùng kết quả.
    const dto = plainToInstance(CreateAccountDto, {
      fullName: raw.fullName,
      email: raw.email,
      department: raw.department,
    });
    for (const error of validateSync(dto)) {
      const field = error.property as ImportField;
      if (!DTO_FIELDS.includes(field) || missing.has(field)) continue;
      const constraints = error.constraints ?? {};
      const code =
        field === 'email' && constraints.isEmail
          ? ImportRowErrorCode.InvalidEmail
          : ImportRowErrorCode.InvalidValue;
      const message =
        code === ImportRowErrorCode.InvalidEmail
          ? 'Email sai định dạng.'
          : (Object.values(constraints)[0] ??
            `${FIELD_LABEL[field]} không hợp lệ.`);
      errors.push(rowError(field, code, message));
    }

    const roleValue = normalizeText(raw.role) as string;
    if (
      !missing.has('role') &&
      roleValue.toLowerCase() !== expectedRole.toLowerCase()
    ) {
      errors.push(
        rowError(
          'role',
          ImportRowErrorCode.InvalidRole,
          `Vai trò không hợp lệ. Tệp này chỉ nhận vai trò "${expectedRole}".`,
        ),
      );
    }

    return {
      raw,
      normalized: {
        rowNumber: raw.rowNumber,
        fullName: dto.fullName,
        email: normalizeEmail(raw.email) as string,
        department: dto.department ?? null,
      },
      errors,
    };
  });

  // Email trùng giữa các dòng trong tệp: đánh dấu MỌI dòng của nhóm trùng, nêu số dòng còn lại.
  const rowsByEmail = new Map<string, ICheckedImportRow[]>();
  for (const row of checked) {
    const email = row.normalized.email;
    if (!email || row.errors.some((error) => error.field === 'email')) continue;
    rowsByEmail.set(email, [...(rowsByEmail.get(email) ?? []), row]);
  }
  for (const group of rowsByEmail.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      const others = group
        .filter((other) => other !== row)
        .map((other) => other.raw.rowNumber);
      row.errors.push({
        ...rowError(
          'email',
          ImportRowErrorCode.DuplicateEmailInFile,
          `Email trùng với dòng ${others.join(', ')} trong tệp.`,
        ),
        relatedRows: others,
      });
    }
  }
  return checked;
}

/** Email đủ điều kiện để hỏi DB (dòng chưa có lỗi về email). */
export function emailsToLookUp(rows: ICheckedImportRow[]): string[] {
  return [
    ...new Set(
      rows
        .filter((row) => !row.errors.some((error) => error.field === 'email'))
        .map((row) => row.normalized.email),
    ),
  ];
}

/** BR-34, BR-38, BR-39: email đã thuộc tài khoản chưa xóa (mọi tổ chức). Không nêu tổ chức nào. */
export function splitImportRows(
  rows: ICheckedImportRow[],
  takenEmails: ReadonlySet<string>,
): { validRows: IValidImportRow[]; invalidRows: IInvalidImportRow[] } {
  const validRows: IValidImportRow[] = [];
  const invalidRows: IInvalidImportRow[] = [];
  for (const row of rows) {
    const errors = [...row.errors];
    if (
      !errors.some((error) => error.field === 'email') &&
      takenEmails.has(row.normalized.email)
    ) {
      errors.push(
        rowError(
          'email',
          ImportRowErrorCode.EmailAlreadyUsed,
          'Email đã được sử dụng cho một tài khoản khác.',
        ),
      );
    }
    if (errors.length === 0) {
      validRows.push(row.normalized);
    } else {
      const { rowNumber, ...values } = row.raw;
      invalidRows.push({ rowNumber, values, errors });
    }
  }
  return { validRows, invalidRows };
}

/**
 * Dấu vân tay của các dòng sẽ được tạo. Preview trả về; confirm tính lại trên dữ liệu hiện tại,
 * khác nhau (tệp khác, email vừa bị dùng, dòng đổi) -> IMPORT_CHANGED.
 */
export function previewDigestOf(
  role: SeatRole,
  validRows: IValidImportRow[],
): string {
  const canonical = JSON.stringify([
    role,
    validRows.map((row) => [
      row.rowNumber,
      row.email,
      row.fullName,
      row.department,
    ]),
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}
