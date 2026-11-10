import type {
  ImportField,
  ImportRowErrorCodeValue,
} from '../member-import.constants';

/** Một dòng dữ liệu đọc từ tệp, giá trị thô (đã đổi về chuỗi). rowNumber = số dòng trong Excel. */
export interface IRawImportRow {
  rowNumber: number;
  fullName: string;
  email: string;
  department: string;
  role: string;
}

export interface IImportRowError {
  field: ImportField;
  code: ImportRowErrorCodeValue;
  message: string;
  /** DUPLICATE_EMAIL_IN_FILE: các dòng khác cùng email. */
  relatedRows?: number[];
}

/** Dòng hợp lệ sau chuẩn hóa (giá trị sẽ được lưu nếu Organizer xác nhận). */
export interface IValidImportRow {
  rowNumber: number;
  fullName: string;
  email: string;
  department: string | null;
}

/** Dòng lỗi: giữ giá trị thô để Organizer đối chiếu với tệp, kèm lý do (BR-34). */
export interface IInvalidImportRow {
  rowNumber: number;
  values: Omit<IRawImportRow, 'rowNumber'>;
  errors: IImportRowError[];
}

export interface IImportSeats {
  used: number;
  max: number;
  remaining: number;
  subscriptionStatus: string | null;
  canCreate: boolean;
}

/** Kết quả preview (BR-32). previewDigest gửi lại lúc confirm để phát hiện dữ liệu đã đổi. */
export interface IMemberImportPreview {
  role: string;
  totalRows: number;
  validRows: IValidImportRow[];
  invalidRows: IInvalidImportRow[];
  seats: IImportSeats;
  /** BR-33: số dòng hợp lệ vượt số chỗ còn lại -> chặn toàn bộ lần import. */
  exceedsSeats: boolean;
  canConfirm: boolean;
  previewDigest: string;
}

export interface IImportedAccount {
  id: string;
  rowNumber: number;
  fullName: string;
  email: string;
  department: string | null;
  status: string;
}

export interface IMemberImportResult {
  role: string;
  createdCount: number;
  skippedCount: number;
  accounts: IImportedAccount[];
}
