import { Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./courses.scss";

type Course = {
  key: string;
  name: string;
  scope: string;
  type: "Public" | "Private";
  status: "Draft" | "Submitted" | "Published" | "Archived";
  instructor: string;
  learners: number | string;
};

const courses: Course[] = [
  { key: "wse", name: "Workplace Safety Essentials", scope: "Certain work unit", type: "Public", status: "Published", instructor: "An Tran", learners: 86 },
  { key: "ir", name: "Incident Reporting", scope: "Organization-wide", type: "Private", status: "Submitted", instructor: "Linh Phan", learners: "—" },
  { key: "eb", name: "Equipment Basics", scope: "Organization-wide", type: "Public", status: "Archived", instructor: "An Tran", learners: 42 },
  { key: "fsr", name: "Fire Safety Refresher", scope: "Organization-wide", type: "Private", status: "Published", instructor: "Giao Le", learners: "—" },
];

const statusTone = (status: Course["status"]) =>
  status === "Published" ? "info" : status === "Submitted" ? "warning" : status === "Archived" ? "neutral" : "neutral";

const Courses = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () => courses.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const columns: ColumnsType<Course> = [
    {
      title: "Course",
      dataIndex: "name",
      render: (_, item) => (
        <div>
          <strong>{item.name}</strong>
          <div className="organizer-note">{item.scope}</div>
        </div>
      ),
    },
    { title: "Type", dataIndex: "type" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: Course["status"]) => (
        <StatusTag tone={statusTone(status)}>{status}</StatusTag>
      ),
    },
    { title: "Instructor", dataIndex: "instructor" },
    { title: "Learners", dataIndex: "learners" },
    {
      title: "Action",
      key: "action",
      align: "right",
      render: (_, item) => (
        <button
          className="organizer-link"
          onClick={() => navigate(`/organizer/courses/${item.key}`)}
        >
          View →
        </button>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-courses">
      <PageHeader
        title="Organization Courses"
        subtitle="View all Courses for assignment, approval, version governance, and ownership."
        actions={
          <Link to="/organizer/courses/approvals">
            <OrganizerButton>Pending approval</OrganizerButton>
          </Link>
        }
      />
      <SectionCard title="All Courses">
        <div className="organizer-filters organizer-courses-filters">
          <Input placeholder="Search Course" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select
            defaultValue="all"
            options={[
              { value: "all", label: "All types" },
              { value: "public", label: "Public" },
              { value: "private", label: "Private" },
            ]}
          />
          <Select
            defaultValue="all"
            options={[
              { value: "all", label: "All statuses" },
              { value: "draft", label: "Draft" },
              { value: "submitted", label: "Submitted" },
              { value: "published", label: "Published" },
              { value: "archived", label: "Archived" },
            ]}
          />
          <Select
            defaultValue="all"
            options={[
              { value: "all", label: "All instructors" },
              { value: "an-tran", label: "An Tran" },
              { value: "linh-phan", label: "Linh Phan" },
              { value: "giao-le", label: "Giao Le" },
            ]}
          />
        </div>
        <Table className="organizer-table" columns={columns} dataSource={rows} pagination={{ pageSize: 6, showSizeChanger: false }} />
      </SectionCard>
    </OrganizerPage>
  );
};

export default Courses;
