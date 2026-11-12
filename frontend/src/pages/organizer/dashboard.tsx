import { Link } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  ProgressLine,
  SectionCard,
  StatCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import "./dashboard.scss";

const Dashboard = () => (
  <OrganizerPage className="organizer-dashboard">
    <PageHeader
      title="Tổng quan đào tạo"
      subtitle="Theo dõi việc hoàn thành đào tạo, hoạt động Khóa học, trạng thái Gói dịch vụ và việc đang chờ xử lý."
    />
    <div className="organizer-stat-grid organizer-dashboard-stats">
      <StatCard label="Học viên" value="318" note="12 tài khoản ngừng hoạt động" />
      <StatCard
        label="Khóa học đang triển khai"
        value="14"
        note="4 Khóa học chờ phê duyệt"
        tone="warning"
      />
      <StatCard
        label="Hoàn thành đào tạo bắt buộc"
        value="82%"
        note="Chỉ tính đào tạo bắt buộc"
        tone="success"
      />
      <StatCard
        label="Trường hợp quá hạn"
        value="23"
        note="Chỉ tính Khóa học bắt buộc"
        tone="error"
      />
    </div>
    <div className="organizer-content-grid">
      <SectionCard title="Tuân thủ đào tạo bắt buộc">
        <div className="organizer-dashboard-progress">
          <ProgressLine label="Hoàn thành đúng hạn" count="204" value={62} />
          <ProgressLine
            label="Hoàn thành trễ hạn"
            count="36"
            value={11}
            tone="amber"
          />
          <ProgressLine label="Quá hạn" count="23" value={7} tone="red" />
          <ProgressLine label="Được miễn" count="12" value={4} tone="blue" />
        </div>
      </SectionCard>
      <SectionCard title="Việc cần xử lý">
        <div className="organizer-action-queue">
          <div>
            <strong>4 Khóa học chờ phê duyệt</strong>
            <span>Khóa học Giảng viên đã gửi</span>
            <Link className="organizer-link" to="/organizer/courses/approvals">
              Xem xét →
            </Link>
          </div>
          <div>
            <strong>7 báo cáo nội dung đang chờ xử lý</strong>
            <span>1 báo cáo sắp đến hạn xử lý</span>
            <Link className="organizer-link" to="/organizer/content-reports">
              Moderate →
            </Link>
          </div>
          <div>
            <strong>Đã dùng 76% dung lượng Gói dịch vụ</strong>
            <span>Theo dõi mức sử dụng và giới hạn</span>
            <Link className="organizer-link" to="/organizer/subscription">
              Xem →
            </Link>
          </div>
          <div>
            <strong>3 lời mời đã hết hạn</strong>
            <span>Lời mời Giảng viên và Học viên</span>
            <Link className="organizer-link" to="/organizer/instructors">
              Resend →
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
    <WarningPanel title="Thông báo Gói dịch vụ">
      Gói Growth sẽ hết hạn vào ngày 18/12/2026 nếu chưa gia hạn. Học viên có
      Chứng chỉ nên tải bản PDF trước khi dịch vụ hết hạn.
    </WarningPanel>
    <div className="organizer-dashboard-actions">
      <Link to="/organizer/subscription">
        <OrganizerButton type="primary">Xem Gói dịch vụ</OrganizerButton>
      </Link>
    </div>
  </OrganizerPage>
);

export default Dashboard;
