import { Input, InputNumber, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderAssignment,
  findCourseStructure,
  findSubmission,
  publishSubmissionGrade,
} from "@/components/instructor/instructor.data";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";
import "./submissions.scss";

const SubmissionFinalize = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const submission = findSubmission(submissionId);
  const structure = submission
    ? findCourseStructure(submission.courseId)
    : undefined;
  const assignment =
    structure && submission
      ? findBuilderAssignment(structure, submission.assignmentId)
      : undefined;

  const [finalScore, setFinalScore] = useState<number | null>(
    submission?.finalScore ?? null,
  );
  const [feedback, setFeedback] = useState(submission?.feedback ?? "");

  if (!submission) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="BÀI NỘP / CHỐT ĐIỂM"
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

  const handlePublish = () => {
    publishSubmissionGrade(submission, finalScore ?? 0, feedback);
    message.success("Đã công bố điểm cuối cùng.");
    navigate("/instructor/submissions");
  };

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="BÀI NỘP / CHỐT ĐIỂM"
        title="Chốt điểm Assignment"
        subtitle="Xác nhận hoặc điều chỉnh điểm tổng hợp trước khi công bố."
        back
      />
      <SectionCard>
        <div className="instructor-finalize-aggregate">
          <span>Điểm tổng hợp từ chấm chéo</span>
          <strong>Trung bình các điểm đánh giá hợp lệ</strong>
        </div>
        <div className="instructor-finalize-fields">
          <div>
            <label>Điểm cuối cùng</label>
            <InputNumber
              style={{ width: "100%" }}
              placeholder="Điểm xác nhận hoặc đã điều chỉnh"
              min={0}
              value={finalScore ?? undefined}
              onChange={(value) =>
                setFinalScore(typeof value === "number" ? value : null)
              }
            />
          </div>
          <div>
            <label>Điểm đạt tối thiểu</label>
            <p className="instructor-finalize-configured">
              {assignment?.passingScore ?? "Chưa cấu hình"}
            </p>
          </div>
        </div>
        <div className="instructor-finalize-feedback">
          <label>Nhận xét cho học viên</label>
          <Input.TextArea
            rows={5}
            placeholder="Giải thích kết quả đánh giá cuối cùng..."
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </div>
        <InfoPanel title="Công bố kết quả">
          Học viên nhận được điểm cuối cùng và nhận xét theo Rubric.
        </InfoPanel>
        <div className="instructor-finalize-actions" style={{ marginTop: 20 }}>
          <InstructorButton type="primary" onClick={handlePublish}>
            Công bố điểm cuối cùng
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default SubmissionFinalize;
