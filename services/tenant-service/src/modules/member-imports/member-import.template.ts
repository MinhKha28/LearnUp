import * as ExcelJS from 'exceljs';
import type { SeatRole } from '../users/users.service';
import { IMPORT_COLUMNS, ROLE_CELL_VALUE } from './member-import.constants';

const DATA_SHEET_NAME = 'Danh sách';
const GUIDE_SHEET_NAME = 'Hướng dẫn';

/** Tệp mẫu: sheet 1 chỉ có dòng tiêu đề (không có dòng ví dụ để không bị import nhầm), sheet 2 là hướng dẫn. */
export async function buildMemberImportTemplate(
  role: SeatRole,
  maxRows: number,
): Promise<Buffer> {
  const roleValue = ROLE_CELL_VALUE[role];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LearnUP';

  const sheet = workbook.addWorksheet(DATA_SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = IMPORT_COLUMNS.map((column) => ({
    header: column.required ? `${column.header} *` : column.header,
    key: column.field,
    width: column.width,
  }));
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  // Gợi ý giá trị cột Vai trò bằng danh sách thả xuống; server vẫn kiểm lại (BR-34).
  const roleColumn =
    IMPORT_COLUMNS.findIndex((column) => column.field === 'role') + 1;
  for (let rowNumber = 2; rowNumber <= maxRows + 1; rowNumber++) {
    sheet.getCell(rowNumber, roleColumn).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${roleValue}"`],
      showErrorMessage: true,
      errorTitle: 'Vai trò không hợp lệ',
      error: `Chỉ nhận "${roleValue}".`,
    };
  }

  const guide = workbook.addWorksheet(GUIDE_SHEET_NAME);
  guide.getColumn(1).width = 100;
  [
    `Điền danh sách ${roleValue} vào sheet "${DATA_SHEET_NAME}", mỗi người một dòng, bắt đầu từ dòng 2.`,
    'Cột có dấu * là bắt buộc. Không đổi tên hoặc xóa dòng tiêu đề.',
    'Email phải đúng định dạng, không trùng trong tệp và chưa được dùng cho tài khoản nào trên LearnUP.',
    `Cột Vai trò ghi "${roleValue}".`,
    `Tối đa ${maxRows} dòng mỗi lần import. Chỉ nhận tệp .xlsx.`,
    'Sau khi tải lên, hệ thống hiển thị các dòng hợp lệ và các dòng lỗi kèm lý do; tài khoản chỉ được tạo khi bạn xác nhận.',
    'Nếu số dòng hợp lệ vượt số chỗ còn lại của Subscription, toàn bộ lần import bị chặn.',
  ].forEach((line, index) => {
    guide.getCell(index + 1, 1).value = line;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
