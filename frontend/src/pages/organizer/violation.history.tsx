import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import "./violation.history.scss";

type InstructorViolations = {
  key: string;
  instructor: string;
  confirmed: number;
  minor: number;
  serious: number;
  latest: string;
};

const rows: InstructorViolations[] = [
  { key: "an-tran", instructor: "Trần An", confirmed: 3, minor: 2, serious: 1, latest: "11/09/2026" },
  { key: "linh-phan", instructor: "Linh Phan", confirmed: 1, minor: 1, serious: 0, latest: "02/08/2026" },
  { key: "giao-le", instructor: "Giao Lê", confirmed: 0, minor: 0, serious: 0, latest: "—" },
];

const ViolationHistory = () => {
  const columns: ColumnsType<InstructorViolations> = [
    { title: "Giảng viên", dataIndex: "instructor" },
    { title: "Đã xác nhận", dataIndex: "confirmed" },
    { title: "Nhẹ", dataIndex: "minor" },
    { title: "Nghiêm trọng", dataIndex: "serious" },
    { title: "Mới nhất", dataIndex: "latest" },
    {
      title: "Thao tác",
      key: "action",
      align: "right",
      render: () => <button className="organizer-link">Xem lịch sử →</button>,
    },
  ];
  return (
    <OrganizerPage className="organizer-violation-history">
      <PageHeader
        title="Lịch sử vi phạm"
        subtitle="Vi phạm đã xác nhận theo Giảng viên. Dữ liệu dùng để hỗ trợ ra quyết định xử lý."
        actions={
          <Link to="/organizer/content-reports">
            <OrganizerButton>Báo cáo nội dung</OrganizerButton>
          </Link>
        }
      />
      <SectionCard title="Vi phạm của Giảng viên">
        <Table className="organizer-table" columns={columns} dataSource={rows} pagination={false} />
      </SectionCard>
      <WarningPanel title="Trần An đã chạm ngưỡng cảnh báo">
        Cảnh báo này không tự động dừng hoạt động của Giảng viên hay bất kỳ Khóa học nào.
      </WarningPanel>
    </OrganizerPage>
  );
};

export default ViolationHistory;
