import { Button } from "antd";
import { Link } from "react-router-dom";
import {
  AdminButton,
  AdminPage,
  PageHeader,
  ProgressLine,
  SectionCard,
  StatCard,
  StatusTag,
  WarningPanel,
} from "@/components/admin/admin.ui";
import "./dashboard.scss";

const Dashboard = () => (
  <AdminPage className="admin-dashboard">
    <PageHeader
      title="Tổng quan nền tảng"
      subtitle="Theo dõi tổ chức, gói dịch vụ, khối lượng kiểm duyệt và rủi ro của nền tảng."
      actions={
        <>
          <AdminButton>Xem xét báo cáo</AdminButton>
          <Link to="/admin/plans/create">
            <AdminButton type="primary">Thêm gói dịch vụ</AdminButton>
          </Link>
        </>
      }
    />
    <WarningPanel title="Báo cáo chuyển cấp cần xem xét">
      Có 2 báo cáo đã chuyển cấp đang chờ quyết định của quản trị nền tảng.
    </WarningPanel>
    <div className="admin-stat-grid admin-dashboard-stats">
      <StatCard label="Tổ chức" value="24" note="Đang hoạt động" tone="neutral" />
      <StatCard
        label="Gói dịch vụ đang hoạt động"
        value="18"
        note="Hiện hành"
        tone="success"
      />
      <StatCard
        label="Báo cáo đã chuyển cấp xử lý"
        value="6"
        note="Cần xem xét"
        tone="warning"
      />
      <StatCard
        label="Tổ chức bị tạm khóa"
        value="2"
        note="Hạn chế"
        tone="error"
      />
    </div>
    <div className="admin-content-grid">
      <SectionCard
        title="Tổ chức theo trạng thái"
        extra={
          <Button type="link" size="small">
            Xem tất cả
          </Button>
        }
      >
        <div className="admin-dashboard-progress">
          <ProgressLine label="Đang hoạt động" count="18" value={75} />
          <ProgressLine
            label="Chờ thanh toán"
            count="3"
            value={38}
            tone="amber"
          />
          <ProgressLine
            label="Trong thời gian ân hạn"
            count="1"
            value={18}
            tone="amber"
          />
          <ProgressLine label="Tạm khóa" count="2" value={28} tone="red" />
        </div>
        <p className="admin-note">
          Tổng quan tình trạng nền tảng
          <br />
          Hầu hết tổ chức đang hoạt động. Hãy xem các tài khoản đang trong thời gian ân hạn hoặc bị tạm khóa.
        </p>
      </SectionCard>
      <SectionCard
        title="Báo cáo đã chuyển cấp xử lý"
        extra={
          <Link className="admin-link" to="/admin/reports">
            Xem tất cả →
          </Link>
        }
      >
        <div className="admin-report-list">
          <div>
            <strong>Khiếu nại về nội dung khóa học</strong>
            <span>Northstar Academy</span>
            <StatusTag tone="error">3 ngày</StatusTag>
          </div>
          <div>
            <strong>Phản hồi của quản lý đào tạo bị khiếu nại</strong>
            <span>Apex Learning</span>
            <StatusTag tone="warning">Đến hạn ngày mai</StatusTag>
          </div>
          <div>
            <strong>Xem xét trạng thái báo cáo</strong>
            <span>BlueRiver Institute</span>
            <StatusTag tone="warning">Quá hạn</StatusTag>
          </div>
        </div>
        <p className="admin-note">
          Tóm tắt các báo cáo nổi bật đã chuyển đến quản trị nền tảng.
        </p>
      </SectionCard>
    </div>
  </AdminPage>
);

export default Dashboard;
