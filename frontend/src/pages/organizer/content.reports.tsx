import { Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./content.reports.scss";

type Report = {
  key: string;
  id: string;
  content: string;
  instructor: string;
  status: "Pending" | "Resolved" | "Dismissed";
  deadline: string;
  mine: boolean;
  result?: string;
};

const reports: Report[] = [
  { key: "rep-220", id: "REP-220", content: "Tài liệu đọc: Các bước bị khóa", instructor: "Trần An", status: "Pending", deadline: "8 giờ", mine: false },
  { key: "rep-217", id: "REP-217", content: "Câu 6 của Bài trắc nghiệm", instructor: "Linh Phan", status: "Pending", deadline: "1 ngày", mine: false },
  { key: "rep-216", id: "REP-216", content: "Yêu cầu Bài tập", instructor: "Giao Lê", status: "Resolved", deadline: "Đã đóng", mine: true, result: "Đã xác nhận vi phạm" },
  { key: "rep-164", id: "REP-164", content: "Video Bài học", instructor: "Vy Nguyễn", status: "Resolved", deadline: "Đã đóng", mine: true, result: "Không có vi phạm" },
];

const reportStatusText: Record<Report["status"], string> = {
  Pending: "Đang chờ",
  Resolved: "Đã xử lý",
  Dismissed: "Đã bác bỏ",
};

const statusTone = (status: Report["status"]) =>
  status === "Pending" ? "warning" : status === "Resolved" ? "success" : "neutral";

const ContentReports = () => {
  const navigate = useNavigate();
  const [mineOnly, setMineOnly] = useState(false);
  const rows = useMemo(
    () => reports.filter((item) => (mineOnly ? item.mine : true)),
    [mineOnly],
  );
  const columns: ColumnsType<Report> = [
    { title: "Báo cáo", dataIndex: "id" },
    { title: "Nội dung", dataIndex: "content" },
    { title: "Giảng viên", dataIndex: "instructor" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (status: Report["status"]) => (
        <StatusTag tone={statusTone(status)}>{reportStatusText[status]}</StatusTag>
      ),
    },
    mineOnly
      ? { title: "Kết quả", dataIndex: "result", render: (value?: string) => value || "—" }
      : { title: "Hạn xử lý", dataIndex: "deadline" },
    {
      title: "Thao tác",
      key: "action",
      align: "right",
      render: (_, item) => (
        <button
          className="organizer-link"
          onClick={() => navigate(`/organizer/content-reports/${item.key}`)}
        >
          Xem →
        </button>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-content-reports">
      <PageHeader
        title={mineOnly ? "Báo cáo của tôi" : "Báo cáo nội dung"}
        subtitle={
          mineOnly
            ? "Theo dõi trạng thái xử lý và kết quả của các báo cáo bạn đã gửi."
            : "Xem các báo cáo trong tổ chức và thời hạn xử lý."
        }
        actions={
          <OrganizerButton onClick={() => setMineOnly((value) => !value)}>
            {mineOnly ? "Tất cả báo cáo" : "Báo cáo của tôi"}
          </OrganizerButton>
        }
      />
      {!mineOnly && (
        <div className="organizer-content-reports-filters">
          <Input className="organizer-content-reports-search" placeholder="Tìm báo cáo" />
          <div className="organizer-content-reports-filter-item">
            <span>Trạng thái</span>
            <Select
              variant="borderless"
              defaultValue="all"
              options={[
                { value: "all", label: "Tất cả" },
                { value: "pending", label: "Đang chờ" },
                { value: "resolved", label: "Đã xử lý" },
                { value: "dismissed", label: "Đã bác bỏ" },
              ]}
            />
          </div>
          <div className="organizer-content-reports-filter-item">
            <span>Mức độ</span>
            <Select
              variant="borderless"
              defaultValue="all"
              options={[{ value: "all", label: "Tất cả" }]}
            />
          </div>
          <div className="organizer-content-reports-filter-item">
            <span>Giảng viên / Hạn xử lý</span>
            <Select
              variant="borderless"
              defaultValue="any"
              options={[{ value: "any", label: "Tất cả" }]}
            />
          </div>
        </div>
      )}
      <SectionCard>
        <Table className="organizer-table" columns={columns} dataSource={rows} pagination={false} />
        {mineOnly && (
          <p className="organizer-note organizer-content-reports-note">
            Quản lý đào tạo có thể gửi báo cáo khi tự phát hiện nội dung có vấn đề.
            Nội dung chỉ có thể bị vô hiệu hóa sau khi báo cáo được xác nhận là vi phạm.
          </p>
        )}
      </SectionCard>
    </OrganizerPage>
  );
};

export default ContentReports;
