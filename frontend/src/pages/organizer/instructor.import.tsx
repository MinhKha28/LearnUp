import { InboxOutlined } from "@ant-design/icons";
import { Table, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./instructor.import.scss";

type ImportRow = {
  key: string;
  row: number;
  name: string;
  email: string;
  workUnit: string;
  status: "Valid" | "Duplicate email" | "Missing field";
};

const rows: ImportRow[] = [
  { key: "1", row: 1, name: "Mai Tran", email: "mai.tran@example.com", workUnit: "Sales", status: "Valid" },
  { key: "2", row: 2, name: "Long Vu", email: "an.tran@example.com", workUnit: "Support", status: "Duplicate email" },
  { key: "3", row: 3, name: "Quan Bui", email: "quan.bui@example.com", workUnit: "Operations", status: "Valid" },
  { key: "4", row: 4, name: "Thu Dao", email: "", workUnit: "HR", status: "Missing field" },
];

const statusTone = (status: ImportRow["status"]) =>
  status === "Valid" ? "success" : "error";

const InstructorImport = () => {
  const navigate = useNavigate();
  const columns: ColumnsType<ImportRow> = [
    { title: "#", dataIndex: "row", width: 48 },
    { title: "Name", dataIndex: "name" },
    { title: "Email", dataIndex: "email", render: (value: string) => value || "—" },
    { title: "Work unit", dataIndex: "workUnit" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: ImportRow["status"]) => (
        <StatusTag tone={statusTone(status)}>{status}</StatusTag>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-instructor-import">
      <PageHeader
        title="Import Instructors"
        subtitle="Bulk import Instructor accounts from an Excel/CSV file."
        back
        actions={
          <>
            <OrganizerButton>Download template</OrganizerButton>
            <OrganizerButton type="primary">Import file</OrganizerButton>
          </>
        }
      />
      <SectionCard title="Upload file">
        <Upload.Dragger multiple={false} beforeUpload={() => false} showUploadList={false}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            Drag and drop file to import, or click to browse
          </p>
          <p className="ant-upload-hint">Accepted formats: .xlsx, .csv</p>
        </Upload.Dragger>
      </SectionCard>
      <SectionCard title="Import preview" className="organizer-import-preview">
        <Table className="organizer-table" columns={columns} dataSource={rows} pagination={false} />
        <p className="organizer-note">
          3 rows valid, 1 row rejected. Rejected rows are skipped and must be
          corrected in the source file.
        </p>
        <div className="organizer-form-actions">
          <OrganizerButton
            type="primary"
            onClick={() => navigate("/organizer/instructors")}
          >
            Submit valid rows
          </OrganizerButton>
        </div>
      </SectionCard>
    </OrganizerPage>
  );
};

export default InstructorImport;
