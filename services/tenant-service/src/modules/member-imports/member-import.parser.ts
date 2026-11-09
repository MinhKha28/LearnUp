import { inflateRawSync } from 'node:zlib';
import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  DEFAULT_IMPORT_MAX_UNCOMPRESSED_BYTES,
  FIELD_LABEL,
  HEADER_ALIASES,
  IMPORT_COLUMNS,
  IMPORT_MAX_ZIP_ENTRIES,
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

// Cấu trúc ZIP (APPNOTE): bản ghi cuối (EOCD), mục lục (central directory), header từng mục.
const EOCD_SIGNATURE = 0x06054b50;
const EOCD_MIN_LENGTH = 22;
const EOCD_MAX_SEARCH = EOCD_MIN_LENGTH + 0xffff; // + comment tối đa 65 535 byte
const CENTRAL_SIGNATURE = 0x02014b50;
const CENTRAL_HEADER_LENGTH = 46;
const LOCAL_SIGNATURE = 0x04034b50;
const LOCAL_HEADER_LENGTH = 30;
const ZIP64_MARKER_32 = 0xffffffff;
const ZIP64_MARKER_16 = 0xffff;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const FLAG_ENCRYPTED = 0x1;

function corruptZip(): BadRequestException {
  return invalidFile('Không đọc được tệp Excel. Hãy dùng tệp mẫu (.xlsx).');
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const stop = Math.max(0, buffer.length - EOCD_MAX_SEARCH);
  for (let at = buffer.length - EOCD_MIN_LENGTH; at >= stop; at--) {
    if (buffer.readUInt32LE(at) === EOCD_SIGNATURE) return at;
  }
  return -1;
}

/**
 * Chống zip bomb (UC12.8 ghi chú 9.4, làm ở UC13.8): giải nén thử từng mục với trần thật
 * (zlib maxOutputLength), cộng dồn dung lượng bung ra. Không tin kích thước khai trong tệp vì
 * exceljs (JSZip) giải nén mà không đối chiếu. Vượt trần, mục mã hóa, kiểu nén lạ, ZIP64
 * hoặc cấu trúc hỏng -> 400 INVALID_IMPORT_FILE. Chỉ đọc buffer trong bộ nhớ, không ghi đĩa.
 */
export function assertZipExpandsWithin(
  buffer: Buffer,
  maxUncompressedBytes: number,
): void {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) throw corruptZip();

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (
    entryCount === ZIP64_MARKER_16 ||
    directorySize === ZIP64_MARKER_32 ||
    directoryOffset === ZIP64_MARKER_32 ||
    directoryOffset + directorySize > eocd
  ) {
    throw corruptZip();
  }
  if (entryCount > IMPORT_MAX_ZIP_ENTRIES) {
    throw invalidFile('Tệp Excel có cấu trúc bất thường. Hãy dùng tệp mẫu.');
  }

  const tooLarge = () =>
    invalidFile(
      `Nội dung tệp Excel quá lớn sau khi giải nén (tối đa ${Math.floor(maxUncompressedBytes / (1024 * 1024))} MB). Hãy dùng tệp mẫu.`,
    );

  let expanded = 0;
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index++) {
    if (
      cursor + CENTRAL_HEADER_LENGTH > eocd ||
      buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE
    ) {
      throw corruptZip();
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    cursor += CENTRAL_HEADER_LENGTH + nameLength + extraLength + commentLength;

    if (compressedSize === ZIP64_MARKER_32 || localOffset === ZIP64_MARKER_32) {
      throw corruptZip();
    }
    if (flags & FLAG_ENCRYPTED) throw corruptZip();

    // Vị trí dữ liệu nén lấy từ header của chính mục đó (tên / extra có thể dài khác mục lục).
    if (
      localOffset + LOCAL_HEADER_LENGTH > buffer.length ||
      buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE
    ) {
      throw corruptZip();
    }
    const dataStart =
      localOffset +
      LOCAL_HEADER_LENGTH +
      buffer.readUInt16LE(localOffset + 26) +
      buffer.readUInt16LE(localOffset + 28);
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw corruptZip();

    const remaining = maxUncompressedBytes - expanded;
    if (method === METHOD_STORED) {
      expanded += compressedSize;
    } else if (method === METHOD_DEFLATE) {
      if (compressedSize === 0) continue;
      if (remaining <= 0) throw tooLarge();
      try {
        expanded += inflateRawSync(buffer.subarray(dataStart, dataEnd), {
          maxOutputLength: remaining,
        }).length;
      } catch (error) {
        // zlib dừng ngay khi vượt maxOutputLength (RangeError ERR_BUFFER_TOO_LARGE).
        if ((error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
          throw tooLarge();
        }
        throw corruptZip();
      }
    } else {
      throw corruptZip();
    }
    if (expanded > maxUncompressedBytes) throw tooLarge();
  }
}

/**
 * Đọc sheet đầu tiên của tệp: dòng 1 là tiêu đề, dữ liệu từ dòng 2. Dòng trống hoàn toàn bị bỏ qua.
 * Thiếu cột bắt buộc -> 400 INVALID_IMPORT_TEMPLATE; quá maxRows dòng dữ liệu -> 400 TOO_MANY_ROWS.
 * Trước khi đưa cho exceljs: kiểm dung lượng giải nén thật (assertZipExpandsWithin).
 */
export async function parseMemberImportFile(
  buffer: Buffer,
  maxRows: number,
  maxUncompressedBytes: number = DEFAULT_IMPORT_MAX_UNCOMPRESSED_BYTES,
): Promise<IRawImportRow[]> {
  assertZipExpandsWithin(buffer, maxUncompressedBytes);

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
