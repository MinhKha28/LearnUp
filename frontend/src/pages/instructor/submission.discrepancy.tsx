import { useNavigate, useParams } from "react-router-dom";
import { findSubmission } from "@/components/instructor/instructor.data";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import "./submissions.scss";

const SubmissionDiscrepancy = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const submission = findSubmission(submissionId);

  if (!submission) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="BÀI NỘP / CẦN CAN THIỆP"
          title="Không tìm thấy bài nộp"
          subtitle="Bài nộp này có thể đã bị xóa."
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/submissions")}>
          Về danh sách bài nộp
        </InstructorButton>
      </InstructorPage>
    );
  }

  const [reviewerA, reviewerB] = submission.reviewers;

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="BÀI NỘP / CẦN CAN THIỆP"
        title="Chênh lệch điểm giữa các người chấm"
        subtitle="Điểm của các người chấm chéo chênh nhau quá ngưỡng đã cấu hình."
        back
      />
      <WarningPanel title="Cần Giảng viên xử lý">
        So sánh điểm theo từng tiêu chí của các người chấm rồi quyết định kết
        quả cuối cùng.
      </WarningPanel>
      <SectionCard className="instructor-discrepancy-card">
        <div className="instructor-discrepancy-table">
          <div className="instructor-discrepancy-row instructor-discrepancy-head">
            <span>Tiêu chí Rubric</span>
            <span>Người chấm: {reviewerA?.reviewerName ?? "Chưa rõ"}</span>
            <span>Người chấm: {reviewerB?.reviewerName ?? "Chưa rõ"}</span>
            <span>Chênh lệch</span>
          </div>
          {submission.criteriaComparison.map((row) => (
            <div
              className="instructor-discrepancy-row"
              key={row.criterionLabel}
            >
              <strong>{row.criterionLabel}</strong>
              <span>{row.reviewerAScoreLabel}</span>
              <span>{row.reviewerBScoreLabel}</span>
              <span>{row.differenceLabel}</span>
            </div>
          ))}
          {submission.criteriaComparison.length === 0 && (
            <div className="instructor-discrepancy-row">
              <span>Chưa có so sánh theo tiêu chí.</span>
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
        <div className="instructor-grade-actions">
          <InstructorButton
            type="primary"
            onClick={() =>
              navigate(`/instructor/submissions/${submission.id}/finalize`)
            }
          >
            Chấm hoặc điều chỉnh điểm cuối cùng
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default SubmissionDiscrepancy;
