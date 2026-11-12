import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import { Alert, App, Empty, Table, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatCard,
  StatusTag,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import type {
  confirmInstructorImportAPI,
  downloadInstructorImportTemplateAPI,
  previewInstructorImportAPI,
} from "@/services/organization.service";
import type {
  IImportApiError,
  IImportRowError,
  IInvalidImportRow,
  IMemberImportPreview,
  IValidImportRow,
  ImportField,
} from "@/types/organization.types";
import { seatBlockReason } from "@/utils/helper";

// UC12.8 (Instructor), UC13.8 (Learner): cùng luồng tải tệp -> xem trước -> xác nhận.
// Trang của từng role truyền role, đường dẫn danh sách và các API tương ứng
// (API Learner có cùng chữ ký với API Instructor).
export type MemberImportRole = "Instructor" | "Learner";

const roleLabel: Record<MemberImportRole, string> = {
  Instructor: "giảng viên",
  Learner: "học viên",
};

export interface MemberImportProps {
  role: MemberImportRole;
  className: string;
  listPath: string;
  templateFileName: string;
  downloadTemplate: typeof downloadInstructorImportTemplateAPI;
  previewImport: typeof previewInstructorImportAPI;
  confirmImport: typeof confirmInstructorImportAPI;
}

const CONNECTION_ERROR = "Không kết nối được với máy chủ. Vui lòng thử lại sau.";

const fieldLabel: Record<ImportField, string> = {
  fullName: "Họ và tên",
  email: "Email",
  department: "Đơn vị công tác",
  role: "Vai trò",
};

// BR-34: lý do lỗi theo từng dòng (mã từ backend -> câu tiếng Anh)
const rowErrorText = (error: IImportRowError, role: MemberImportRole): string => {
  switch (error.code) {
    case "MISSING_REQUIRED_FIELD":
      return `Cần điền ${fieldLabel[error.field]}.`;
    case "INVALID_EMAIL":
      return "Định dạng email không hợp lệ.";
    case "DUPLICATE_EMAIL_IN_FILE":
      return error.relatedRows?.length
        ? `Email trùng với dòng ${error.relatedRows.join(", ")} trong tệp.`
        : "Email bị trùng trong tệp.";
    case "EMAIL_ALREADY_USED":
      return "Email đã được tài khoản khác sử dụng.";
    case "INVALID_ROLE":
      return `Vai trò không hợp lệ. Cột "Role" chỉ chấp nhận giá trị "${role}".`;
    default:
      return `${fieldLabel[error.field]} không hợp lệ.`;
  }
};

const withDash = (value: string | null | undefined) =>
  value && value.trim() !== "" ? value : "—";

const validColumns: ColumnsType<IValidImportRow> = [
  { title: "Dòng", dataIndex: "rowNumber", width: 64 },
  { title: "Họ và tên", dataIndex: "fullName" },
  { title: "Email", dataIndex: "email" },
  { title: "Đơn vị công tác", dataIndex: "department", render: withDash },
];

const invalidColumnsOf = (
  role: MemberImportRole,
): ColumnsType<IInvalidImportRow> => [
  { title: "Dòng", dataIndex: "rowNumber", width: 64 },
  {
    title: "Họ và tên",
    render: (_, row) => withDash(row.values.fullName),
  },
  { title: "Email", render: (_, row) => withDash(row.values.email) },
  {
    title: "Đơn vị công tác",
    render: (_, row) => withDash(row.values.department),
  },
  { title: "Vai trò", render: (_, row) => withDash(row.values.role) },
  {
    title: "Lý do",
    render: (_, row) => (
      <ul className="organizer-import-reasons">
        {row.errors.map((error, index) => (
          <li key={`${error.field}-${error.code}-${index}`}>
            {rowErrorText(error, role)}
          </li>
        ))}
      </ul>
    ),
  },
];

// Lỗi cấp tệp / cấp lần import -> thông báo
const importErrorText = (
  role: MemberImportRole,
  error?: IImportApiError,
): string => {
  switch (error?.code) {
    case "INVALID_IMPORT_FILE":
      return "Không thể đọc tệp. Hãy tải lên tệp Excel (.xlsx) theo mẫu.";
    case "INVALID_IMPORT_TEMPLATE":
      return error.missingColumns?.length
        ? `Tệp thiếu cột bắt buộc: ${error.missingColumns.join(", ")}. Hãy dùng tệp mẫu.`
        : "Tệp không đúng mẫu.";
    case "TOO_MANY_ROWS":
      return `Tệp có quá nhiều dòng. Mỗi lần chỉ có thể nhập tối đa ${error.maxRows ?? 500} dòng.`;
    case "EMPTY_IMPORT_FILE":
      return "Tệp không có dòng dữ liệu.";
    case "FILE_TOO_LARGE":
      return error.maxSizeBytes
        ? `Tệp quá lớn. Dung lượng tối đa là ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(error.maxSizeBytes / 1024 / 1024)} MB.`
        : "Tệp quá lớn.";
    case "IMPORT_FILE_REQUIRED":
      return "Chọn tệp Excel để nhập.";
    case "NO_VALID_ROWS":
      return "Tệp không có dòng hợp lệ để nhập.";
    case "IMPORT_EXCEEDS_SEATS":
      return `Số dòng hợp lệ vượt quá ${error.remaining ?? 0} suất ${roleLabel[role]} còn lại. Hệ thống chưa nhập dữ liệu.`;
    case "IMPORT_CHANGED":
      return "Dữ liệu đã thay đổi từ lúc xem trước (ví dụ: một email vừa được sử dụng). Hãy kiểm tra kết quả mới và xác nhận lại.";
    case "EMAIL_ALREADY_USED":
      return "Một email trong tệp vừa được tài khoản khác sử dụng. Hệ thống chưa nhập dữ liệu. Hãy tải lại tệp để kiểm tra.";
    case "SEAT_LIMIT_REACHED":
      return `Đã dùng hết suất ${roleLabel[role]}. Hệ thống chưa nhập dữ liệu.`;
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Gói dịch vụ chưa hoạt động. Không thể tạo tài khoản mới.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Tổ chức đang bị tạm ngưng. Không thể tạo tài khoản mới.";
    case "FORBIDDEN":
      return `Bạn không có quyền nhập tài khoản ${roleLabel[role]}.`;
    default:
      return "Không thể xử lý tệp. Vui lòng thử lại.";
  }
};

const errorOf = (res: unknown) =>
  (res as { error?: IImportApiError } | undefined)?.error;

const MemberImport = ({
  role,
  className,
  listPath,
  templateFileName,
  downloadTemplate,
  previewImport,
  confirmImport,
}: MemberImportProps) => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<IMemberImportPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function runPreview(nextFile: File) {
    setFile(nextFile);
    setPreview(null);
    setFileError(null);
    setSubmitError(null);
    setChecking(true);
    try {
      const res = await previewImport(nextFile);
      if (res.data?.previewDigest) {
        setPreview(res.data);
      } else {
        setFileError(importErrorText(role, errorOf(res)));
      }
    } catch {
      setFileError(CONNECTION_ERROR);
    } finally {
      setChecking(false);
    }
  }

  async function submitImport() {
    if (!file || !preview || submitting) return; // chống bấm 2 lần
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await confirmImport(file, preview.previewDigest);
      if (res.data && typeof res.data.createdCount === "number") {
        message.success(
          `Đã tạo ${res.data.createdCount} tài khoản ${roleLabel[role]}. Email mời sẽ được gửi.`,
        );
        navigate(listPath);
        return;
      }
      const error = errorOf(res);
      // Dữ liệu đổi sau preview: hiện kết quả mới để Organizer xác nhận lại
      if (error?.code === "IMPORT_CHANGED" && error.preview) {
        setPreview(error.preview);
      }
      setSubmitError(importErrorText(role, error));
    } catch {
      setSubmitError(CONNECTION_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveTemplate() {
    setDownloading(true);
    try {
      const blob = await downloadTemplate();
      if (!blob) {
        message.error("Không thể tải tệp mẫu. Vui lòng thử lại.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = templateFileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error(CONNECTION_ERROR);
    } finally {
      setDownloading(false);
    }
  }

  const blockedReason =
    preview && !preview.seats.canCreate
      ? seatBlockReason(preview.seats, roleLabel[role])
      : null;
  const validCount = preview?.validRows.length ?? 0;
  const invalidCount = preview?.invalidRows.length ?? 0;

  return (
    <OrganizerPage className={className}>
      <PageHeader
        title={`Nhập tài khoản ${roleLabel[role]}`}
        subtitle="Tải tệp Excel lên, kiểm tra dữ liệu rồi xác nhận để tạo tài khoản và gửi lời mời."
        back
        actions={
          <OrganizerButton
            icon={<DownloadOutlined aria-hidden="true" />}
            loading={downloading}
            onClick={saveTemplate}
          >
            Tải tệp mẫu
          </OrganizerButton>
        }
      />
      <SectionCard title="Tải tệp lên">
        <div className="organizer-note organizer-import-columns">
          <p>Tệp mẫu gồm 4 cột. Không đổi tên cột (tiêu đề giữ nguyên tiếng Anh):</p>
          <ul>
            <li><strong>Full name</strong>: họ và tên đầy đủ.</li>
            <li><strong>Email</strong>: địa chỉ email dùng để đăng nhập, không trùng với tài khoản khác.</li>
            <li><strong>Department</strong>: đơn vị công tác (có thể để trống).</li>
            <li><strong>Role</strong>: vai trò, điền đúng giá trị "{role}".</li>
          </ul>
        </div>
        <Upload.Dragger
          accept=".xlsx"
          multiple={false}
          maxCount={1}
          showUploadList={false}
          disabled={checking || submitting}
          beforeUpload={(nextFile) => {
            runPreview(nextFile);
            return Upload.LIST_IGNORE;
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined aria-hidden="true" />
          </p>
          <p className="ant-upload-text">
            {checking
              ? "Đang kiểm tra tệp…"
              : "Kéo thả tệp vào đây hoặc bấm để chọn tệp"}
          </p>
          <p className="ant-upload-hint">
            Định dạng chấp nhận: .xlsx (dùng tệp mẫu). Giữ nguyên tên các cột
            trong tệp mẫu.
          </p>
        </Upload.Dragger>
        {file && !checking && (
          <p className="organizer-note organizer-import-file">
            Tệp đã chọn: <strong>{file.name}</strong>
          </p>
        )}
        {fileError && (
          <Alert
            className="organizer-import-alert"
            type="error"
            showIcon
            message={fileError}
          />
        )}
      </SectionCard>

      {preview && (
        <SectionCard title="Xem trước dữ liệu nhập" className="organizer-import-preview">
          <div className="organizer-stat-grid organizer-import-stats">
            <StatCard label="Số dòng trong tệp" value={preview.totalRows} />
            <StatCard
              label="Dòng hợp lệ"
              value={validCount}
              tone="success"
              note="Sẽ tạo tài khoản"
            />
            <StatCard
              label="Dòng có lỗi"
              value={invalidCount}
              tone={invalidCount > 0 ? "error" : "neutral"}
              note={invalidCount > 0 ? "Sẽ bỏ qua" : undefined}
            />
            <StatCard
              label="Suất còn lại"
              value={preview.seats.remaining}
              tone={preview.exceedsSeats ? "error" : "neutral"}
              note={`Đã dùng ${preview.seats.used}/${preview.seats.max} suất`}
            />
          </div>

          {blockedReason ? (
            <WarningPanel title="Không thể tạo tài khoản">
              {blockedReason}
            </WarningPanel>
          ) : (
            preview.exceedsSeats && (
              // BR-33: chặn toàn bộ lần import, không import một phần
              <WarningPanel title={`Không đủ suất ${roleLabel[role]}`}>
                Tệp có {validCount} dòng hợp lệ nhưng chỉ còn{" "}
                {preview.seats.remaining} suất. Hệ thống sẽ không nhập dòng nào.
                Hãy bớt dòng hoặc giải phóng suất, rồi tải lại tệp.
              </WarningPanel>
            )
          )}

          {invalidCount > 0 && (
            <>
              <h3 className="organizer-import-heading">
                Dòng có lỗi{" "}
                <StatusTag tone="error">{invalidCount}</StatusTag>
              </h3>
              <Table<IInvalidImportRow>
                className="organizer-table"
                rowKey="rowNumber"
                columns={invalidColumnsOf(role)}
                dataSource={preview.invalidRows}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                scroll={{ x: "max-content" }}
              />
            </>
          )}

          <h3 className="organizer-import-heading">
            Dòng hợp lệ <StatusTag tone="success">{validCount}</StatusTag>
          </h3>
          <Table<IValidImportRow>
            className="organizer-table"
            rowKey="rowNumber"
            columns={validColumns}
            dataSource={preview.validRows}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: "max-content" }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Không có dòng hợp lệ."
                />
              ),
            }}
          />

          <p className="organizer-note">
            Các dòng lỗi sẽ bị bỏ qua; hãy sửa trong tệp và nhập lại sau. Mỗi
            {roleLabel[role]} mới sẽ nhận email mời để đặt mật khẩu và kích hoạt tài khoản.
          </p>
          {submitError && (
            <Alert
              className="organizer-import-alert"
              type="error"
              showIcon
              message={submitError}
            />
          )}
          <div className="organizer-form-actions">
            <OrganizerButton onClick={() => navigate(listPath)}>
              Hủy
            </OrganizerButton>
            <OrganizerButton
              type="primary"
              loading={submitting}
              disabled={!preview.canConfirm || checking}
              onClick={submitImport}
            >
              {validCount > 0
                ? `Tạo ${validCount} tài khoản và gửi lời mời`
                : "Tạo tài khoản"}
            </OrganizerButton>
          </div>
        </SectionCard>
      )}
    </OrganizerPage>
  );
};

export default MemberImport;
