import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  FIELD_LABEL,
  HEADER_ALIASES,
  IMPORT_COLUMNS,
  type ImportField,
} from './member-import.constants';
import type { IRawImportRow } from './interfaces/member-import.interface';

// Tệp .xlsx là gói ZIP: 4 byte đầu "PK\x03\x04". Chặn tệp đổi đuôi trước khi đưa cho exceljs.
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

const HEADER_ROW = 1;

function invalidFile(message: string): BadRequestException {
  return new BadRequestException({ code: 'INVALID_IMPORT_FILE', message });
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\*/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Giá trị hiển thị của ô (hyperlink, rich text, công thức đều về chữ hiển thị). */
function cellText(row: ExcelJS.Row, column: number | undefined): string {
  if (column === undefined) return '';
  const cell = row.getCell(column);
  try {
    return typeof cell.text === 'string' ? cell.text : '';
  } catch {
    return '';
  }
}

/** Kiểm sơ bộ trước khi đọc: đúng đuôi .xlsx và đúng chữ ký ZIP. */
export function assertXlsxFile(originalName: string, buffer: Buffer): void {
  const isXlsxName = /\.xlsx$/i.test(originalName);
  const hasZipMagic =
    buffer.length >= ZIP_MAGIC.length &&
    ZIP_MAGIC.every((byte, index) => buffer[index] === byte);
  if (!isXlsxName || !hasZipMagic) {
    throw invalidFile('Chỉ nhận tệp Excel định dạng .xlsx.');
  }
}

/**
 * Đọc sheet đầu tiên của tệp: dòng 1 là tiêu đề, dữ liệu từ dòng 2. Dòng trống hoàn toàn bị bỏ qua.
 * Thiếu cột bắt buộc -> 400 INVALID_IMPORT_TEMPLATE; quá maxRows dòng dữ liệu -> 400 TOO_MANY_ROWS.
 */
export async function parseMemberImportFile(
  buffer: Buffer,
  maxRows: number,
): Promise<IRawImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw invalidFile('Không đọc được tệp Excel. Hãy dùng tệp mẫu (.xlsx).');
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw invalidFile('Tệp không có sheet dữ liệu.');

  // Vị trí cột theo tiêu đề, không theo thứ tự cố định.
  const columnOf: Partial<Record<ImportField, number>> = {};
  sheet.getRow(HEADER_ROW).eachCell((cell, column) => {
    const header = normalizeHeader(cell.text ?? '');
    for (const { field } of IMPORT_COLUMNS) {
      if (
        columnOf[field] === undefined &&
        HEADER_ALIASES[field].includes(header)
      ) {
        columnOf[field] = column;
      }
    }
  });

  const missing = IMPORT_COLUMNS.filter(
    (column) => column.required && columnOf[column.field] === undefined,
  ).map((column) => FIELD_LABEL[column.field]);
  if (missing.length > 0) {
    throw new BadRequestException({
      code: 'INVALID_IMPORT_TEMPLATE',
      message: `Tệp thiếu cột bắt buộc: ${missing.join(', ')}. Hãy dùng tệp mẫu.`,
      missingColumns: missing,
    });
  }

  const rows: IRawImportRow[] = [];
  for (
    let rowNumber = HEADER_ROW + 1;
    rowNumber <= sheet.rowCount;
    rowNumber++
  ) {
    const row = sheet.getRow(rowNumber);
    const raw: IRawImportRow = {
      rowNumber,
      fullName: cellText(row, columnOf.fullName),
      email: cellText(row, columnOf.email),
      department: cellText(row, columnOf.department),
      role: cellText(row, columnOf.role),
    };
    const isBlank = [raw.fullName, raw.email, raw.department, raw.role].every(
      (value) => value.trim() === '',
    );
    if (isBlank) continue;

    rows.push(raw);
    if (rows.length > maxRows) {
      throw new BadRequestException({
        code: 'TOO_MANY_ROWS',
        message: `Tệp có quá nhiều dòng. Tối đa ${maxRows} dòng mỗi lần import.`,
        maxRows,
      });
    }
  }

  if (rows.length === 0) {
    throw new BadRequestException({
      code: 'EMPTY_IMPORT_FILE',
      message: 'Tệp không có dòng dữ liệu nào.',
    });
  }
  return rows;
}
