import { SearchOutlined } from "@ant-design/icons";
import { Avatar, Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminButton, AdminPage, PageHeader, SectionCard, StatCard, StatusTag } from "@/components/admin/admin.ui";
import "./organizations.scss";

type Organization = { key: string; name: string; id: string; plan: string; status: string; subscription: string; expires: string; color: string };
const organizations: Organization[] = [
  { key: "northstar", name: "Northstar Learning", id: "ORG-024", plan: "Growth", status: "Active", subscription: "Current", expires: "18 Dec 2026", color: "#dbeafe" },
  { key: "apex", name: "Apex Manufacturing", id: "ORG-018", plan: "Enterprise", status: "Active", subscription: "Grace period", expires: "24 Sep 2026", color: "#ede9fe" },
  { key: "blueriver", name: "BlueRiver Retail", id: "ORG-011", plan: "Growth", status: "Active", subscription: "Current", expires: "02 Jan 2027", color: "#fae8ff" },
  { key: "vertex", name: "Vertex Institute", id: "ORG-009", plan: "Starter", status: "Active", subscription: "Pending payment", expires: "—", color: "#ffe4e6" },
  { key: "greenfield", name: "Greenfield Services", id: "ORG-004", plan: "Growth", status: "Suspended", subscription: "Suspended", expires: "11 Nov 2026", color: "#fee2e2" },
];

const Organizations = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => organizations.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [query]);
  const columns: ColumnsType<Organization> = [
    { title: "Organization", dataIndex: "name", render: (_, record) => <div className="admin-avatar-name"><Avatar style={{ background: record.color, color: "#475569" }}>{record.name.slice(0,2).toUpperCase()}</Avatar><div><strong>{record.name}</strong><small>{record.id}</small></div></div> },
    { title: "Plan", dataIndex: "plan" },
    { title: "Org status", dataIndex: "status", render: (status: string) => <StatusTag tone={status === "Active" ? "success" : "error"}>{status}</StatusTag> },
    { title: "Subscription", dataIndex: "subscription", render: (value: string) => <StatusTag tone={value === "Current" ? "info" : value === "Suspended" ? "neutral" : "warning"}>{value}</StatusTag> },
    { title: "Expires", dataIndex: "expires" },
    { title: "Action", key: "action", align: "right", render: (_, record) => <button className="admin-link" onClick={() => navigate(`/admin/organizations/${record.key}`)}>View details</button> },
  ];
  return (
    <AdminPage className="admin-organizations">
      <PageHeader title="Organizations" subtitle="View and monitor every organization, its current plan, organization status, and subscription lifecycle." actions={<Link to="/admin/suspended-organizations"><AdminButton>View suspended</AdminButton></Link>} />
      <div className="admin-stat-grid admin-organizations-stats">
        <StatCard label="Total organizations" value="24" note="All records" />
        <StatCard label="Active organizations" value="18" note="Active" tone="success" />
        <StatCard label="Suspended" value="2" note="Review" tone="error" />
        <StatCard label="Subscription expiring soon" value="4" note="Within 30 days" tone="warning" />
      </div>
      <SectionCard title="All organizations" extra={<span className="admin-note">24 organizations</span>}>
        <div className="admin-filters">
          <Input prefix={<SearchOutlined />} placeholder="Search organization name" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select defaultValue="all" options={[{ value: "all", label: "All plans" },{ value: "growth", label: "Growth" },{ value: "enterprise", label: "Enterprise" }]} />
          <Select defaultValue="all" options={[{ value: "all", label: "All statuses" },{ value: "active", label: "Active" },{ value: "suspended", label: "Suspended" }]} />
          <Select defaultValue="all" options={[{ value: "all", label: "All subscription statuses" },{ value: "current", label: "Current" },{ value: "grace", label: "Grace period" }]} />
        </div>
        <Table className="admin-table" columns={columns} dataSource={rows} pagination={{ pageSize: 5, showSizeChanger: false, position: ["bottomRight"] }} />
      </SectionCard>
    </AdminPage>
  );
};

export default Organizations;
