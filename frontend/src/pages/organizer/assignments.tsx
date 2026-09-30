import { Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link, useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./assignments.scss";

type Assignment = {
  key: string;
  learner: string;
  course: string;
  required: boolean;
  due: string;
  progress: string;
  status: "In progress" | "Completed" | "Overdue" | "Exempt";
};

const rows: Assignment[] = [
  { key: "1", learner: "Minh Le", course: "Workplace Safety Essentials", required: true, due: "30 Sep", progress: "68%", status: "In progress" },
  { key: "2", learner: "Trang Nguyen", course: "Incident Reporting", required: true, due: "22 Sep", progress: "100%", status: "Completed" },
  { key: "3", learner: "Bao Tran", course: "Security Awareness", required: true, due: "26 Sep", progress: "45%", status: "Overdue" },
  { key: "4", learner: "Khanh Vo", course: "Fire Safety Refresher", required: true, due: "15 Oct", progress: "12%", status: "Exempt" },
];

const statusTone = (status: Assignment["status"]) =>
  status === "Completed" ? "success" : status === "Overdue" ? "error" : status === "Exempt" ? "warning" : "info";

const Assignments = () => {
  const navigate = useNavigate();
  const columns: ColumnsType<Assignment> = [
    { title: "Learner", dataIndex: "learner" },
    {
      title: "Course",
      dataIndex: "course",
      render: (course: string) => (
        <div>
          <strong>{course}</strong>
          <div className="organizer-note">Required</div>
        </div>
      ),
    },
    { title: "Due", dataIndex: "due" },
    { title: "Progress", dataIndex: "progress" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: Assignment["status"]) => (
        <StatusTag tone={statusTone(status)}>{status}</StatusTag>
      ),
    },
    {
      title: "Action",
      key: "action",
      align: "right",
      render: (_, item) => (
        <button
          className="organizer-link"
          onClick={() => navigate(`/organizer/assignments/${item.key}`)}
        >
          View →
        </button>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-assignments">
      <PageHeader
        title="Required Training Assignments"
        subtitle="Monitor all Required Enrollments created by Organizer."
        actions={
          <Link to="/organizer/assignments/assign">
            <OrganizerButton type="primary">Assign Course</OrganizerButton>
          </Link>
        }
      />
      <SectionCard title="Assignments">
        <div className="organizer-filters organizer-assignments-filters">
          <Input placeholder="Search Course or Learner" />
          <Select
            defaultValue="all"
            options={[
              { value: "all", label: "All statuses" },
              { value: "in-progress", label: "In progress" },
              { value: "completed", label: "Completed" },
              { value: "overdue", label: "Overdue" },
              { value: "exempt", label: "Exempt" },
            ]}
          />
          <Select
            defaultValue="any"
            options={[{ value: "any", label: "Any due date" }]}
          />
        </div>
        <Table className="organizer-table" columns={columns} dataSource={rows} pagination={{ pageSize: 6, showSizeChanger: false }} />
      </SectionCard>
    </OrganizerPage>
  );
};

export default Assignments;
