import { SearchOutlined } from "@ant-design/icons";
import { Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { AdminPage, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import "./reports.scss";

type Report = { key: string; id: string; subject: string; organization: string; reason: string; status: string; deadline: string };
const rows: Report[] = [
  { key: "rep-1042", id: "REP-1042", subject: "Course content report", organization: "Northstar Learning", reason: "Organizer response disputed", status: "Escalated", deadline: "Due in 4h" },
  { key: "rep-1038", id: "REP-1038", subject: "Course content report", organization: "Apex Manufacturing", reason: "Report handling overdue", status: "Escalated", deadline: "Due tomorrow" },
  { key: "rep-1024", id: "REP-1024", subject: "Organization report", organization: "BlueRiver Retail", reason: "System-wide content concern", status: "Under review", deadline: "1 day" },
  { key: "rep-1021", id: "REP-1021", subject: "Course content report", organization: "Vertex Institute", reason: "Report response escalation", status: "Escalated", deadline: "3 days" },
  { key: "rep-1019", id: "REP-1019", subject: "Course content report", organization: "Greenfield Services", reason: "Organizer response disputed", status: "Under review", deadline: "4 days" },
];
const Reports = () => {
  const navigate = useNavigate();
  const columns: ColumnsType<Report> = [
    { title: "Report", dataIndex: "id", render: (_, item) => <div className="admin-report-id"><strong>{item.id}</strong><span>{item.subject}</span></div> },
    { title: "Organization", dataIndex: "organization" },{ title: "Reason", dataIndex: "reason" },
    { title: "Status", dataIndex: "status", render: (value: string) => <StatusTag tone="warning">{value}</StatusTag> },
    { title: "Deadline", dataIndex: "deadline", render: (value: string) => <span className="admin-deadline">{value}</span> },
    { title: "", key: "action", align: "right", render: (_, item) => <button className="admin-link" onClick={() => navigate(`/admin/reports/${item.key}`)}>View →</button> },
  ];
  return <AdminPage className="admin-reports"><PageHeader title="Escalated Reports" subtitle="Review reports escalated to Platform Admin." /><div className="admin-report-filters"><Input prefix={<SearchOutlined />} placeholder="Search Organization" /><Select defaultValue="all" options={[{ value: "all", label: "All statuses" }]} /><Select defaultValue="all" options={[{ value: "all", label: "All reasons" }]} /><Select defaultValue="all" options={[{ value: "all", label: "Any date" }]} /></div><SectionCard title="Platform report queue" extra={<span className="admin-note">5 reports require action</span>}><Table className="admin-table" dataSource={rows} columns={columns} pagination={false} /></SectionCard></AdminPage>;
};
export default Reports;
