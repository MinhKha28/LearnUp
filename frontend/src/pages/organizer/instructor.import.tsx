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
import {
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
import "./instructor.import.scss";

const LIST_PATH = "/organizer/instructors";
const TEMPLATE_FILE_NAME = "learnup-instructor-import-template.xlsx";
const CONNECTION_ERROR = "Could not connect to the server. Please try again later.";

const fieldLabel: Record<ImportField, string> = {
  fullName: "Full name",
  email: "Email",
  department: "Department",
  role: "Role",
};

// UC12.8 - BR-34: lý do lỗi theo từng dòng (mã từ backend -> câu tiếng Anh)
const rowErrorText = (error: IImportRowError): string => {
  switch (error.code) {
    case "MISSING_REQUIRED_FIELD":
      return `${fieldLabel[error.field]} is required.`;
    case "INVALID_EMAIL":
      return "Email format is invalid.";
    case "DUPLICATE_EMAIL_IN_FILE":
      return error.relatedRows?.length
        ? `Email is duplicated in row ${error.relatedRows.join(", ")} of this file.`
        : "Email is duplicated in this file.";
    case "EMAIL_ALREADY_USED":
      return "Email is already used by another account.";
    case "INVALID_ROLE":
      return 'Role is invalid. Only "Instructor" is accepted.';
    default:
      return `${fieldLabel[error.field]} is invalid.`;
  }
};

const withDash = (value: string | null | undefined) =>
  value && value.trim() !== "" ? value : "—";

const validColumns: ColumnsType<IValidImportRow> = [
  { title: "Row", dataIndex: "rowNumber", width: 64 },
  { title: "Full name", dataIndex: "fullName" },
  { title: "Email", dataIndex: "email" },
  { title: "Department", dataIndex: "department", render: withDash },
];

const invalidColumns: ColumnsType<IInvalidImportRow> = [
  { title: "Row", dataIndex: "rowNumber", width: 64 },
  {
    title: "Full name",
    render: (_, row) => withDash(row.values.fullName),
  },
  { title: "Email", render: (_, row) => withDash(row.values.email) },
  {
    title: "Department",
    render: (_, row) => withDash(row.values.department),
  },
  { title: "Role", render: (_, row) => withDash(row.values.role) },
  {
    title: "Reason",
    render: (_, row) => (
      <ul className="organizer-import-reasons">
        {row.errors.map((error, index) => (
          <li key={`${error.field}-${error.code}-${index}`}>
            {rowErrorText(error)}
          </li>
        ))}
      </ul>
    ),
  },
];

// UC12.8: lỗi cấp tệp / cấp lần import -> thông báo
const importErrorText = (error?: IImportApiError): string => {
  switch (error?.code) {
    case "INVALID_IMPORT_FILE":
      return "The file could not be read. Upload an Excel file (.xlsx) based on the template.";
    case "INVALID_IMPORT_TEMPLATE":
      return error.missingColumns?.length
        ? `The file is missing required columns: ${error.missingColumns.join(", ")}. Use the template.`
        : "The file does not match the template.";
    case "TOO_MANY_ROWS":
      return `The file has too many rows. Up to ${error.maxRows ?? 500} rows can be imported at a time.`;
    case "EMPTY_IMPORT_FILE":
      return "The file has no data rows.";
    case "FILE_TOO_LARGE":
      return error.maxSizeBytes
        ? `The file is too large. The maximum size is ${(error.maxSizeBytes / 1024 / 1024).toFixed(1)} MB.`
        : "The file is too large.";
    case "IMPORT_FILE_REQUIRED":
      return "Choose an Excel file to import.";
    case "NO_VALID_ROWS":
      return "The file has no valid rows to import.";
    case "IMPORT_EXCEEDS_SEATS":
      return `The file has ${error.validCount ?? "more"} valid rows but only ${error.remaining ?? 0} Instructor seats are left. Nothing was imported.`;
    case "IMPORT_CHANGED":
      return "The data changed since the preview (for example, an email was just used). Review the updated preview and confirm again.";
    case "EMAIL_ALREADY_USED":
      return "An email in the file was just used by another account. Nothing was imported. Upload the file again to review.";
    case "SEAT_LIMIT_REACHED":
      return "All Instructor seats are in use. Nothing was imported.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Your Subscription is not active. New accounts cannot be created.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Your Organization is suspended. New accounts cannot be created.";
    case "FORBIDDEN":
      return "You do not have permission to import Instructors.";
    default:
      return "The file could not be processed. Please try again.";
  }
};

const errorOf = (res: unknown) =>
  (res as { error?: IImportApiError } | undefined)?.error;

const InstructorImport = () => {
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
      const res = await previewInstructorImportAPI(nextFile);
      if (res.data?.previewDigest) {
        setPreview(res.data);
      } else {
        setFileError(importErrorText(errorOf(res)));
      }
    } catch {
      setFileError(CONNECTION_ERROR);
    } finally {
      setChecking(false);
    }
  }

  async function confirmImport() {
    if (!file || !preview || submitting) return; // chống bấm 2 lần
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await confirmInstructorImportAPI(file, preview.previewDigest);
      if (res.data && typeof res.data.createdCount === "number") {
        message.success(
          `${res.data.createdCount} Instructor account(s) created. Invitation emails will be sent.`,
        );
        navigate(LIST_PATH);
        return;
      }
      const error = errorOf(res);
      // Dữ liệu đổi sau preview: hiện kết quả mới để Organizer xác nhận lại
      if (error?.code === "IMPORT_CHANGED" && error.preview) {
        setPreview(error.preview);
      }
      setSubmitError(importErrorText(error));
    } catch {
      setSubmitError(CONNECTION_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadTemplate() {
    setDownloading(true);
    try {
      const blob = await downloadInstructorImportTemplateAPI();
      if (!blob) {
        message.error("Could not download the template. Please try again.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = TEMPLATE_FILE_NAME;
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
      ? seatBlockReason(preview.seats, "Instructor")
      : null;
  const validCount = preview?.validRows.length ?? 0;
  const invalidCount = preview?.invalidRows.length ?? 0;

  return (
    <OrganizerPage className="organizer-instructor-import">
      <PageHeader
        title="Import Instructors"
        subtitle="Upload an Excel file, review the rows, then confirm to create accounts and send invitations."
        back
        actions={
          <OrganizerButton
            icon={<DownloadOutlined />}
            loading={downloading}
            onClick={downloadTemplate}
          >
            Download template
          </OrganizerButton>
        }
      />
      <SectionCard title="Upload file">
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
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            {checking
              ? "Checking file…"
              : "Drag and drop file to import, or click to browse"}
          </p>
          <p className="ant-upload-hint">
            Accepted format: .xlsx (use the template). Columns: Full name, Email,
            Department, Role.
          </p>
        </Upload.Dragger>
        {file && !checking && (
          <p className="organizer-note organizer-import-file">
            Selected file: <strong>{file.name}</strong>
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
        <SectionCard title="Import preview" className="organizer-import-preview">
          <div className="organizer-stat-grid organizer-import-stats">
            <StatCard label="Rows in file" value={preview.totalRows} />
            <StatCard
              label="Valid rows"
              value={validCount}
              tone="success"
              note="Will be created"
            />
            <StatCard
              label="Rows with errors"
              value={invalidCount}
              tone={invalidCount > 0 ? "error" : "neutral"}
              note={invalidCount > 0 ? "Will be skipped" : undefined}
            />
            <StatCard
              label="Seats left"
              value={preview.seats.remaining}
              tone={preview.exceedsSeats ? "error" : "neutral"}
              note={`${preview.seats.used} / ${preview.seats.max} used`}
            />
          </div>

          {blockedReason ? (
            <WarningPanel title="Accounts cannot be created">
              {blockedReason}
            </WarningPanel>
          ) : (
            preview.exceedsSeats && (
              // BR-33: chặn toàn bộ lần import, không import một phần
              <WarningPanel title="Not enough Instructor seats">
                The file has {validCount} valid rows but only{" "}
                {preview.seats.remaining} seats are left. Nothing will be
                imported. Remove rows or free seats, then upload the file
                again.
              </WarningPanel>
            )
          )}

          {invalidCount > 0 && (
            <>
              <h3 className="organizer-import-heading">
                Rows with errors{" "}
                <StatusTag tone="error">{invalidCount}</StatusTag>
              </h3>
              <Table<IInvalidImportRow>
                className="organizer-table"
                rowKey="rowNumber"
                columns={invalidColumns}
                dataSource={preview.invalidRows}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                scroll={{ x: "max-content" }}
              />
            </>
          )}

          <h3 className="organizer-import-heading">
            Valid rows <StatusTag tone="success">{validCount}</StatusTag>
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
                  description="No valid rows."
                />
              ),
            }}
          />

          <p className="organizer-note">
            Rows with errors are skipped; correct them in the file and import
            them again later. Each new Instructor receives an invitation email
            to set a password and activate the account.
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
            <OrganizerButton onClick={() => navigate(LIST_PATH)}>
              Cancel
            </OrganizerButton>
            <OrganizerButton
              type="primary"
              loading={submitting}
              disabled={!preview.canConfirm || checking}
              onClick={confirmImport}
            >
              {validCount > 0
                ? `Create ${validCount} account${validCount > 1 ? "s" : ""} and send invitations`
                : "Create accounts"}
            </OrganizerButton>
          </div>
        </SectionCard>
      )}
    </OrganizerPage>
  );
};

export default InstructorImport;
