import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AdminPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/admin/admin.ui";
import "./suspended.organizations.scss";

type Suspended = {
  key: string;
  organization: string;
  id: string;
  date: string;
  reason: string;
};
const data: Suspended[] = [
  {
    key: "greenfield",
    organization: "Greenfield Services",
    id: "ORG-004",
    date: "12/09/2026",
    reason: "Nhiều lần xử lý báo cáo quá hạn",
  },
  {
    key: "metro",
    organization: "Metro Skills Center",
    id: "ORG-017",
    date: "03/09/2026",
    reason: "Vi phạm trên toàn hệ thống",
  },
];
const SuspendedOrganizations = () => {
  const columns: ColumnsType<Suspended> = [
    {
      title: "Tổ chức",
      dataIndex: "organization",
      render: (_, item) => (
        <div className="admin-report-id">
          <strong>{item.organization}</strong>
          <span>{item.id}</span>
        </div>
      ),
    },
    { title: "Bị tạm khóa từ", dataIndex: "date" },
    { title: "Lý do", dataIndex: "reason" },
    {
      title: "Thao tác",
      align: "right",
      render: () => <button className="admin-link">Xem xét →</button>,
    },
  ];
  return (
    <AdminPage className="admin-suspended">
      <PageHeader
        title="Tổ chức bị tạm khóa"
        subtitle="Các tổ chức đang bị tạm khóa ở cấp nền tảng."
      />
      <WarningPanel title="Tạm khóa cấp nền tảng">
        Chỉ tạm khóa tổ chức khi có căn cứ ở cấp tổ chức. Quyết định tạm khóa chặn quyền truy cập của tổ chức trên LearnUP. Sau khi khắc phục, quản lý đào tạo có thẩm quyền sẽ nhận được quyết định xử lý.
      </WarningPanel>
      <SectionCard title="2 tổ chức bị tạm khóa">
        <Table
          className="admin-table"
          columns={columns}
          dataSource={data}
          pagination={false}
        />
      </SectionCard>
      <p className="admin-note">
        Khôi phục sau khi vi phạm được khắc phục.
      </p>
    </AdminPage>
  );
};
export default SuspendedOrganizations;
