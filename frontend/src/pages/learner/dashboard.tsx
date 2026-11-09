import { useNavigate } from "react-router-dom";
import {
  CourseListItem,
  LearnerButton,
  LearnerPage,
  PageHeader,
  SectionCard,
  StatusTag,
  WarningPanel,
} from "@/components/learner/learner.ui";
import "./dashboard.scss";

const requiredTraining = [
  {
    title: "An toàn lao động cơ bản",
    pills: [
      { label: "Bắt buộc", tone: "warning" as const },
      { label: "Quá hạn", tone: "error" as const },
    ],
    meta: "Hạn 23/09/2026",
    progress: 65,
    to: "/learner/courses/workplace-safety",
  },
  {
    title: "Quy trình vận hành",
    pills: [
      { label: "Bắt buộc", tone: "warning" as const },
      { label: "Đang học", tone: "neutral" as const },
    ],
    meta: "Hạn 30/09/2026",
    progress: 32,
    to: "/learner/courses/operational-procedures",
  },
];

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <LearnerPage className="learner-dashboard">
      <PageHeader
        eyebrow="Học viên"
        title="Tổng quan việc học của bạn"
        subtitle="Khóa học bắt buộc được ưu tiên. Tiếp tục từ chỗ bạn đã dừng."
      />
      <WarningPanel title="Khóa học bắt buộc đã quá hạn">
        Bạn vẫn có thể tiếp tục và hoàn thành Khóa học này.
      </WarningPanel>
      <h2 className="learner-dashboard-section-title">Đào tạo bắt buộc</h2>
      <div className="learner-course-list learner-dashboard-required">
        {requiredTraining.map((course) => (
          <CourseListItem
            key={course.title}
            title={course.title}
            pills={course.pills}
            meta={course.meta}
            progress={course.progress}
            to={course.to}
          />
        ))}
      </div>
      <h2 className="learner-dashboard-section-title">Tiếp theo</h2>
      <div className="learner-dashboard-upnext-grid">
        <SectionCard className="learner-upnext-card">
          <h3>Nhiệm vụ chấm chéo</h3>
          <p>Các bài được giao đang chờ nhận xét của bạn</p>
          <div className="learner-upnext-footer">
            <StatusTag tone="warning">2 đang chờ</StatusTag>
            <LearnerButton onClick={() => navigate("/learner/peer-review")}>
              Xem nhiệm vụ
            </LearnerButton>
          </div>
        </SectionCard>
        <SectionCard className="learner-upnext-card">
          <h3>Chứng chỉ của bạn</h3>
          <p>Lưu bản sao các Chứng chỉ đã cấp.</p>
          <div className="learner-upnext-footer">
            <span />
            <LearnerButton onClick={() => navigate("/learner/certificates")}>
              Xem tất cả
            </LearnerButton>
          </div>
        </SectionCard>
      </div>
    </LearnerPage>
  );
};

export default Dashboard;
