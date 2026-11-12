import { useState } from "react";
import { Input, Select, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  courseDetails,
  findResource,
  type ReportContentType,
} from "@/components/learner/learner.data";
import { InfoPanel, LearnerButton, LearnerPage, PageHeader, SectionCard } from "@/components/learner/learner.ui";
import { reportContentTypeLabel } from "@/components/learner/report.labels";
import "./report.content.scss";

const contentTypeOptions = (Object.keys(reportContentTypeLabel) as ReportContentType[]).map(
  (value) => ({ value, label: reportContentTypeLabel[value] }),
);

const ReportContent = () => {
  const { enrollmentId: courseId, lessonId, resourceId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const found = course ? findResource(course, lessonId, resourceId) : undefined;

  const defaultContentType: ReportContentType = found?.resource.type === "video" ? "Video" : "Reading";
  const [reportedItem, setReportedItem] = useState(
    found?.resource.title ?? "",
  );
  const [contentType, setContentType] = useState<ReportContentType>(defaultContentType);
  const [reason, setReason] = useState("");

  if (!course || !found) {
    return (
      <LearnerPage className="report-content">
        <PageHeader eyebrow="Khóa học / Báo cáo nội dung" title="Không tìm thấy nội dung" subtitle="" back />
        <LearnerButton onClick={() => navigate("/learner/courses")}>Quay lại khóa học của tôi</LearnerButton>
      </LearnerPage>
    );
  }

  const submit = () => {
    if (!reason.trim()) {
      message.warning("Hãy mô tả vấn đề trước khi gửi báo cáo.");
      return;
    }
    message.success("Đã gửi báo cáo. Quản lý đào tạo sẽ xem xét.");
    navigate("/learner/reports");
  };

  return (
    <LearnerPage className="report-content">
      <PageHeader
        eyebrow="Khóa học / Báo cáo nội dung"
        title="Báo cáo nội dung khóa học"
        subtitle="Cho tổ chức biết nội dung nào cần xem xét."
        back
      />
      <div className="report-content-body">
        <div className="report-content-card">
          <span>Nội dung được báo cáo</span>
          <Input value={reportedItem} onChange={(event) => setReportedItem(event.target.value)} />
          <span>Loại nội dung</span>
          <Select<ReportContentType>
            value={contentType}
            options={contentTypeOptions}
            onChange={setContentType}
          />
          <span>Lý do báo cáo</span>
          <Input.TextArea
            rows={6}
            placeholder="Mô tả vấn đề với nội dung này…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <InfoPanel title="Quy trình xem xét">
            Báo cáo đã gửi sẽ chờ Quản lý đào tạo xem xét.
          </InfoPanel>
          <div className="report-content-actions">
            <LearnerButton type="primary" onClick={submit}>
              Gửi báo cáo
            </LearnerButton>
          </div>
        </div>
        <SectionCard title="Nội dung có thể báo cáo" className="report-content-side">
          <p>Bài học, video, tài liệu đọc, nội dung bài trắc nghiệm hoặc hướng dẫn bài tập.</p>
        </SectionCard>
      </div>
    </LearnerPage>
  );
};

export default ReportContent;
