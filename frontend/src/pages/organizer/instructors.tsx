import { SearchOutlined } from "@ant-design/icons";
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
import "./instructors.scss";

type Instructor = {
  key: string;
  name: string;
  email: string;
  workUnit: string;
  courses: number;
  status: "Active" | "Invitation expired" | "Disabled";
};

const instructors: Instructor[] = [
  { key: "an-tran", name: "An Tran", email: "an.tran@example.com", workUnit: "Engineering", courses: 4, status: "Active" },
  { key: "linh-phan", name: "Linh Phan", email: "linh.phan@example.com", workUnit: "Compliance", courses: 3, status: "Active" },
  { key: "giao-le", name: "Giao Le", email: "giao.le@example.com", workUnit: "Operations", courses: 2, status: "Invitation expired" },
  { key: "vy-nguyen", name: "Vy Nguyen", email: "vy.nguyen@example.com", workUnit: "HR", courses: 1, status: "Disabled" },
];

const statusTone = (status: Instructor["status"]) =>
  status === "Active" ? "success" : status === "Invitation expired" ? "warning" : "neutral";

const Instructors = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () => instructors.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const columns: ColumnsType<Instructor> = [
    {
      title: "Instructor",
      dataIndex: "name",
      render: (_, item) => (
        <div>
          <strong>{item.name}</strong>
          <div className="organizer-note">{item.email}</div>
        </div>
      ),
    },
    { title: "Work unit", dataIndex: "workUnit" },
    { title: "Courses", dataIndex: "courses" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: Instructor["status"]) => (
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
          onClick={() => navigate(`/organizer/instructors/${item.key}`)}
        >
          View details →
        </button>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-instructors">
      <PageHeader
        title="Instructors"
        subtitle="Manage instructor accounts and available seats."
        actions={
          <>
            <Link to="/organizer/instructors/import">
              <OrganizerButton>Import Excel</OrganizerButton>
            </Link>
            <Link to="/organizer/instructors/add">
              <OrganizerButton type="primary">Add Instructor</OrganizerButton>
            </Link>
          </>
        }
      />
      <SectionCard
        title="Instructor accounts"
        extra={<span className="organizer-note">18 / 25 seats used</span>}
      >
        <div className="organizer-filters organizer-instructors-filters">
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search by name or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            defaultValue="all"
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "expired", label: "Invitation expired" },
              { value: "disabled", label: "Disabled" },
            ]}
          />
        </div>
        <Table
          className="organizer-table"
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 6, showSizeChanger: false, position: ["bottomRight"] }}
        />
      </SectionCard>
    </OrganizerPage>
  );
};

export default Instructors;
