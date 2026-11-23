import { SearchOutlined } from "@ant-design/icons";
import { Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { AdminPage, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import "./reports.scss";

type Report = { key: string; id: string; subject: string; organization: string; reason: string; status: string; deadline: string };
const rows: Report[] = [
  { key: "rep-1042", id: "REP-1042", subject: "Báo cáo nội dung khóa học", organization: "Northstar Learning", reason: "Phản hồi của quản lý đào tạo bị khiếu nại", status: "Đã chuyển cấp", deadline: "Còn 4 giờ đến hạn" },
  { key: "rep-1038", id: "REP-1038", subject: "Báo cáo nội dung khóa học", organization: "Apex Manufacturing", reason: "Quá hạn xử lý báo cáo", status: "Đã chuyển cấp", deadline: "Đến hạn ngày mai" },
  { key: "rep-1024", id: "REP-1024", subject: "Báo cáo về tổ chức", organization: "BlueRiver Retail", reason: "Vấn đề nội dung trên toàn hệ thống", status: "Đang xem xét", deadline: "1 ngày" },
  { key: "rep-1021", id: "REP-1021", subject: "Báo cáo nội dung khóa học", organization: "Vertex Institute", reason: "Yêu cầu chuyển cấp phản hồi báo cáo", status: "Đã chuyển cấp", deadline: "3 ngày" },
  { key: "rep-1019", id: "REP-1019", subject: "Báo cáo nội dung khóa học", organization: "Greenfield Services", reason: "Phản hồi của quản lý đào tạo bị khiếu nại", status: "Đang xem xét", deadline: "4 ngày" },
];
const Reports = () => {
  const navigate = useNavigate();
  const columns: ColumnsType<Report> = [
    { title: "Báo cáo", dataIndex: "id", render: (_, item) => <div className="admin-report-id"><strong>{item.id}</strong><span>{item.subject}</span></div> },
    { title: "Tổ chức", dataIndex: "organization" },{ title: "Lý do", dataIndex: "reason" },
    { title: "Trạng thái", dataIndex: "status", render: (value: string) => <StatusTag tone="warning">{value}</StatusTag> },
    { title: "Hạn xử lý", dataIndex: "deadline", render: (value: string) => <span className="admin-deadline">{value}</span> },
    { title: "", key: "action", align: "right", render: (_, item) => <button className="admin-link" onClick={() => navigate(`/admin/reports/${item.key}`)}>Xem →</button> },
  ];
  return <AdminPage className="admin-reports"><PageHeader title="Báo cáo đã chuyển cấp xử lý" subtitle="Xem xét báo cáo đã chuyển đến quản trị nền tảng." /><div className="admin-report-filters"><Input prefix={<SearchOutlined aria-hidden="true" />} placeholder="Tìm tổ chức" /><Select defaultValue="all" options={[{ value: "all", label: "Tất cả trạng thái" }]} /><Select defaultValue="all" options={[{ value: "all", label: "Tất cả lý do" }]} /><Select defaultValue="all" options={[{ value: "all", label: "Mọi ngày" }]} /></div><SectionCard title="Báo cáo đang chờ xử lý ở cấp nền tảng" extra={<span className="admin-note">Có 5 báo cáo cần xử lý</span>}><Table className="admin-table" dataSource={rows} columns={columns} pagination={false} /></SectionCard></AdminPage>;
};
export default Reports;
