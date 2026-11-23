import { AdminPage, PageHeader, ProgressLine, SectionCard, StatCard } from "@/components/admin/admin.ui";
import "./statistics.scss";

const Statistics = () => <AdminPage className="admin-statistics">
  <PageHeader title="Thống kê nền tảng" subtitle="Thống kê vận hành toàn nền tảng dành cho quản trị viên." />
  <div className="admin-stat-grid admin-statistics-kpis"><StatCard label="Tổng số tổ chức" value="24" note="Tất cả đang hoạt động" /><StatCard label="Gói dịch vụ sắp hết hạn" value="4" note="Trong 30 ngày tới" tone="warning" /><StatCard label="Báo cáo đã chuyển cấp xử lý" value="6" note="Cần xem xét" tone="warning" /><StatCard label="Tổ chức bị tạm khóa" value="2" note="Cấp nền tảng" tone="error" /></div>
  <div className="admin-statistics-grid"><SectionCard title="Tổ chức theo trạng thái"><div className="admin-stack"><ProgressLine label="Đang hoạt động" count="18" value={75} /><ProgressLine label="Chờ thanh toán" count="3" value={38} tone="amber" /><ProgressLine label="Trong thời gian ân hạn" count="1" value={18} tone="amber" /><ProgressLine label="Tạm khóa" count="2" value={26} tone="red" /></div></SectionCard><SectionCard title="Tổ chức theo gói dịch vụ"><div className="admin-stack"><ProgressLine label="Khởi đầu" count="5" value={30} /><ProgressLine label="Gói Tăng trưởng" count="12" value={70} /><ProgressLine label="Doanh nghiệp" count="7" value={42} tone="blue" /></div></SectionCard></div>
  <SectionCard title="Xử lý báo cáo"><div className="admin-report-metrics"><div><strong>6</strong><span>Mới chuyển cấp</span></div><div><strong>31</strong><span>Đã xử lý trong tháng này</span></div><div><strong>14</strong><span>Trong hạn</span></div><div><strong className="admin-error-text">2</strong><span>Quá hạn</span></div></div><p className="admin-note">Trang này hiển thị các chỉ số vận hành dành cho quản trị viên.</p></SectionCard>
</AdminPage>;
export default Statistics;
