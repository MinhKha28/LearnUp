import { useState } from "react";
import { Input, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { findContentReport } from "@/components/learner/learner.data";
import { LearnerButton, LearnerPage, PageHeader, SectionCard, StatusTag } from "@/components/learner/learner.ui";
import { reportDecisionLabel } from "@/components/learner/report.labels";
import "./report.escalate.scss";

const ReportEscalate = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const report = findContentReport(reportId);
  const [reason, setReason] = useState("");

  if (!report || report.status !== "dismissed") {
    return (
      <LearnerPage className="report-escalate">
        <PageHeader
          eyebrow="Báo cáo của tôi / Chuyển cấp xử lý"
          title="Không thể chuyển cấp xử lý báo cáo này"
          subtitle="Chỉ báo cáo đã bị bác bỏ mới có thể gửi đến Quản trị viên nền tảng."
          back
        />
        <LearnerButton onClick={() => navigate("/learner/reports")}>Quay lại báo cáo của tôi</LearnerButton>
      </LearnerPage>
    );
  }

  const submit = () => {
    if (!reason.trim()) {
      message.warning("Hãy nêu lý do cần xem xét lại quyết định này.");
      return;
    }
    message.success("Đã chuyển cấp xử lý. Quản trị viên nền tảng sẽ xem xét báo cáo.");
    navigate("/learner/reports");
  };

  return (
    <LearnerPage className="report-escalate">
      <PageHeader
        eyebrow="Báo cáo của tôi / Chuyển cấp xử lý"
        title="Chuyển cấp xử lý báo cáo"
        subtitle="Đề nghị Quản trị viên nền tảng xem xét lại quyết định."
        back
      />
      <div className="report-escalate-body">
        <div className="report-escalate-card">
          <StatusTag tone="neutral">Đã bác bỏ</StatusTag>
          <h3>{report.reportedItem}</h3>
          <p>Quyết định của Quản lý đào tạo: {report.decision ? reportDecisionLabel[report.decision] : "—"}</p>
          <hr />
          <span>Lý do chuyển cấp xử lý</span>
          <Input.TextArea
            rows={6}
            placeholder="Nêu lý do cần xem xét lại quyết định này…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="report-escalate-actions">
            <LearnerButton type="primary" onClick={submit}>
              Chuyển cấp xử lý
            </LearnerButton>
          </div>
        </div>
        <SectionCard title="Chuyển cấp xử lý" className="report-escalate-side">
          <p>Quản trị viên nền tảng đưa ra quyết định cuối cùng.</p>
          <p>Bạn sẽ thấy kết quả trong Báo cáo của tôi sau khi báo cáo được xử lý.</p>
        </SectionCard>
      </div>
    </LearnerPage>
  );
};

export default ReportEscalate;
