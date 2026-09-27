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
import "./learners.scss";

type Learner = {
  key: string;
  name: string;
  email: string;
  workUnit: string;
  training: string;
  status: "Active" | "Pending" | "Disabled";
};

const learners: Learner[] = [
  { key: "minh-le", name: "Minh Le", email: "minh.le@example.com", workUnit: "Engineering", training: "3 active · 1 overdue", status: "Active" },
  { key: "trang-nguyen", name: "Trang Nguyen", email: "trang.nguyen@example.com", workUnit: "HR", training: "2 active", status: "Active" },
  { key: "bao-tran", name: "Bao Tran", email: "bao@example.com", workUnit: "Operations", training: "Invitation pending", status: "Pending" },
  { key: "khanh-vo", name: "Khanh Vo", email: "khanh@example.com", workUnit: "Engineering", training: "Enrollment paused", status: "Disabled" },
];

const statusTone = (status: Learner["status"]) =>
  status === "Active" ? "success" : status === "Pending" ? "warning" : "neutral";

const Learners = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () => learners.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const columns: ColumnsType<Learner> = [
    {
      title: "Learner",
      dataIndex: "name",
      render: (_, item) => (
        <div>
          <strong>{item.name}</strong>
          <div className="organizer-note">{item.email}</div>
        </div>
      ),
    },
    { title: "Work unit", dataIndex: "workUnit" },
    { title: "Training", dataIndex: "training" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: Learner["status"]) => (
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
          onClick={() => navigate(`/organizer/learners/${item.key}`)}
        >
          View details →
        </button>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-learners">
      <PageHeader
        title="Learners"
        subtitle="Manage Learner accounts and monitor training participation."
        actions={
          <>
            <Link to="/organizer/learners/import">
              <OrganizerButton>Import Excel</OrganizerButton>
            </Link>
            <Link to="/organizer/learners/add">
              <OrganizerButton type="primary">Add Learner</OrganizerButton>
            </Link>
          </>
        }
      />
      <SectionCard
        title="Learner accounts"
        extra={<span className="organizer-note">318 / 500 seats used</span>}
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
              { value: "pending", label: "Pending" },
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

export default Learners;
