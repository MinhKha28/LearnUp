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
  status: "Valid" | "Duplicate email" | "Seat limit reached";
};

const rows: ImportRow[] = [
  { key: "1", row: 1, name: "Nam Pham", email: "nam.pham@example.com", workUnit: "Sales", status: "Valid" },
  { key: "2", row: 2, name: "Y Nguyen", email: "y.nguyen@example.com", workUnit: "Support", status: "Valid" },
  { key: "3", row: 3, name: "Hoa Dang", email: "minh.le@example.com", workUnit: "Engineering", status: "Duplicate email" },
  { key: "4", row: 4, name: "Kien Vo", email: "kien.vo@example.com", workUnit: "Operations", status: "Seat limit reached" },
];

const statusTone = (status: ImportRow["status"]) =>
  status === "Valid" ? "success" : "error";

const LearnerImport = () => {
  const navigate = useNavigate();
  const columns: ColumnsType<ImportRow> = [
    { title: "#", dataIndex: "row", width: 48 },
    { title: "Name", dataIndex: "name" },
    { title: "Email", dataIndex: "email" },
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
        title="Import Learners"
        subtitle="Bulk import Learner accounts from an Excel/CSV file."
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
          2 rows valid, 2 rows rejected. Seat-limited rows require a plan
          upgrade before submitting again.
        </p>
        <div className="organizer-form-actions">
          <OrganizerButton
            type="primary"
            onClick={() => navigate("/organizer/learners")}
          >
            Submit valid rows
          </OrganizerButton>
        </div>
      </SectionCard>
    </OrganizerPage>
  );
};

export default LearnerImport;
