import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link, useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";

type Submitted = {
  key: string;
  course: string;
  instructor: string;
  submitted: string;
  type: "Public" | "Private";
};

const rows: Submitted[] = [
  { key: "ir", course: "Incident Reporting", instructor: "Linh Phan", submitted: "21 Sep 2026", type: "Private" },
  { key: "dpe", course: "Data Privacy Essentials", instructor: "Vy Nguyen", submitted: "20 Sep 2026", type: "Public" },
  { key: "cs", course: "Customer Safety", instructor: "Giao Le", submitted: "18 Sep 2026", type: "Private" },
  { key: "sa", course: "Security Awareness", instructor: "An Tran", submitted: "17 Sep 2026", type: "Public" },
];

const CourseApprovals = () => {
  const navigate = useNavigate();
  const columns: ColumnsType<Submitted> = [
    { title: "Course", dataIndex: "course" },
    { title: "Instructor", dataIndex: "instructor" },
    { title: "Submitted", dataIndex: "submitted" },
    {
      title: "Type",
      dataIndex: "type",
      render: (type: Submitted["type"]) => (
        <StatusTag tone={type === "Public" ? "info" : "neutral"}>{type}</StatusTag>
      ),
    },
    {
      title: "Action",
      key: "action",
      align: "right",
      render: (_, item) => (
        <button
          className="organizer-link"
          onClick={() => navigate(`/organizer/courses/${item.key}/review`)}
        >
          Review →
        </button>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-course-approvals">
      <PageHeader
        title="Courses Awaiting Approval"
        subtitle="Review Courses currently in Submitted status."
        actions={
          <Link to="/organizer/courses">
            <OrganizerButton>All Courses</OrganizerButton>
          </Link>
        }
      />
      <SectionCard title="4 submitted Courses">
        <Table className="organizer-table" columns={columns} dataSource={rows} pagination={false} />
      </SectionCard>
    </OrganizerPage>
  );
};

export default CourseApprovals;
