import { useState } from "react";
import { Modal } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  assignmentStatusLabel,
  courseDetails,
  findAssignment,
} from "@/components/learner/learner.data";
import {
  DetailItem,
  InfoPanel,
  LearnerButton,
  PageHeader,
  StatCard,
  StatusTag,
  WarningPanel,
} from "@/components/learner/learner.ui";
import "./assignment.detail.scss";

const AssignmentDetail = () => {
  const { enrollmentId: courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const assignment = course ? findAssignment(course, assignmentId) : undefined;
  const [resultModalOpen, setResultModalOpen] = useState(false);

  if (!course || !assignment) {
    return null;
  }

  const audienceLabel = course.audience === "required" ? "Bắt buộc" : "Tự chọn";

  if (assignment.status === "locked") {
    return (
      <>
        <PageHeader
          eyebrow="Bài đánh giá / Bài tập"
          title={assignment.title}
          subtitle="Tài khoản của bạn đang bị tạm khóa nộp bài tập này."
        />
        <div className="course-learning-content">
          <WarningPanel title="Tạm khóa nộp bài">
            Bạn đã dùng hết lượt nộp liên tiếp mà chưa đạt điểm tối thiểu.
          </WarningPanel>
          <div className="assignment-locked-card">
            <span>Bạn có thể nộp lại từ</span>
            <strong>{assignment.lockedUntil}</strong>
            <p>Số lượt nộp liên tiếp được đặt lại khi hết thời gian khóa.</p>
            {assignment.grading && (
              <LearnerButton onClick={() => setResultModalOpen(true)}>Xem kết quả gần nhất</LearnerButton>
            )}
          </div>
        </div>
        <Modal
          open={resultModalOpen}
          onCancel={() => setResultModalOpen(false)}
          footer={null}
          title="Kết quả gần nhất"
        >
          {assignment.grading ? (
            <p>
              Điểm cuối cùng: <strong>{assignment.grading.finalScore}%</strong> (tối thiểu{" "}
              {assignment.grading.passThreshold}%)
            </p>
          ) : (
            <p>Chưa có kết quả chấm trước đó.</p>
          )}
        </Modal>
      </>
    );
  }

  if (assignment.status === "graded" && assignment.grading) {
    const grading = assignment.grading;
    return (
      <>
        <PageHeader
          eyebrow="Bài đánh giá / Kết quả"
          title="Kết quả bài tập"
          subtitle={`${assignment.title} / Bài nộp gần nhất`}
        />
        <div className="course-learning-content">
          <div className="assignment-result-card">
            <StatusTag tone="success">{grading.published ? "Đã công bố" : "Đang chờ"}</StatusTag>
            <div className="assignment-result-stats">
              <StatCard label="Điểm cuối cùng" value={`${grading.finalScore}%`} />
              <StatCard label="Điểm tối thiểu" value={`${grading.passThreshold}%`} />
            </div>
          </div>
          <div className="assignment-rubric-card">
            <h3>Tiêu chí chấm điểm và nhận xét</h3>
            <table className="assignment-rubric-table">
              <thead>
                <tr>
                  <th>Tiêu chí</th>
                  <th>Điểm</th>
                  <th>Nhận xét</th>
                </tr>
              </thead>
              <tbody>
                {grading.criteria.map((criterion) => (
                  <tr key={criterion.name}>
                    <td>
                      <strong>{criterion.name}</strong>
                    </td>
                    <td>
                      {criterion.score}/{criterion.maxScore}
                    </td>
                    <td>{criterion.feedback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <InfoPanel title="Ẩn danh người chấm">
              Người nộp bài không thấy danh tính người chấm chéo.
            </InfoPanel>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Bài đánh giá / Bài tập"
        title={assignment.title}
        subtitle={`${course.title} / Bài tập (${audienceLabel})`}
      />
      <div className="course-learning-main">
          <div className="course-learning-content assignment-instructions-card">
            <StatusTag tone={course.audience === "required" ? "warning" : "info"}>
              {audienceLabel}
            </StatusTag>
            <h3>Hướng dẫn</h3>
            {assignment.instructions.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <hr />
            <h3>Tiêu chí đánh giá</h3>
            <p>Tiêu chí chấm điểm: {assignment.rubric}</p>
            <p>Điểm tối thiểu: {assignment.minScore}%</p>
            <p>Thời gian dự kiến: {assignment.estimatedEffort}</p>
            <InfoPanel title="Quy định nộp bài">
              Bài tập không có hạn nộp riêng. Hệ thống ghi nhận bài nộp gần nhất.
            </InfoPanel>
            <div className="assignment-instructions-actions">
              {assignment.status === "not-submitted" && (
                <LearnerButton
                  type="primary"
                  onClick={() => navigate(`/learner/courses/${course.id}/assignments/${assignment.id}/submit`)}
                >
                  Nộp bài tập
                </LearnerButton>
              )}
              {assignment.status === "returned" && (
                <LearnerButton
                  type="primary"
                  onClick={() => navigate(`/learner/courses/${course.id}/assignments/${assignment.id}/resubmit`)}
                >
                  Nộp lại bài tập
                </LearnerButton>
              )}
            </div>
          </div>
          <div className="course-learning-side">
            <div className="assignment-status-panel">
              <h3>Trạng thái của bạn</h3>
              <StatusTag
                tone={
                  assignment.status === "returned"
                    ? "error"
                    : assignment.status === "submitted"
                      ? "warning"
                      : "neutral"
                }
              >
                {assignmentStatusLabel(assignment.status)}
              </StatusTag>
              <DetailItem label="Số lượt nộp liên tiếp còn lại">
                {assignment.attemptsRemaining}
              </DetailItem>
              {assignment.submission && (
                <DetailItem label="Lần nộp gần nhất">{assignment.submission.submittedAt}</DetailItem>
              )}
            </div>
          </div>
        </div>
    </>
  );
};

export default AssignmentDetail;
