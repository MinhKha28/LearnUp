import { useEffect, useState } from "react";
import { Alert, Spin } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import FileLink from "@/components/instructor/submission.file.link";
import { getSubmissionDetailAPI } from "@/services/instructor.submission.service";
import type { ISubmissionDetail } from "@/types/submission.types";
import {
  formatDateTime,
  gradingStatusView,
  interventionLabel,
  personName,
  reviewerRoleLabel,
  reviewStatusView,
} from "@/utils/submission.labels";
import "./submissions.scss";

const SubmissionDetail = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ISubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submissionId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSubmissionDetailAPI(submissionId);
        if (!active) return;
        if (res.data) setDetail(res.data);
        else
          setError(
            "Không tìm thấy bài nộp này, hoặc bạn không phụ trách chấm bài này.",
          );
      } catch {
        if (active) setError("Không kết nối được với máy chủ.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [submissionId]);

  if (loading) {
    return (
      <InstructorPage className="instructor-submissions">
        <Spin />
      </InstructorPage>
    );
  }

  if (error || !detail) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="Bài nộp / Chi tiết"
          title="Không tìm thấy bài nộp"
          subtitle={error ?? "Bài nộp này có thể đã bị xóa."}
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Về Khóa học của tôi
        </InstructorButton>
      </InstructorPage>
    );
  }

  const status = gradingStatusView(detail.gradingStatus);
  const reason = interventionLabel(detail.interventionReason);
  const rubricMax = detail.assignment.rubric.reduce(
    (sum, criterion) => sum + criterion.maxPoints,
    0,
  );
  const canGrade =
    detail.isLatest && detail.gradingStatus === "AwaitingInstructor";

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="Bài nộp / Chi tiết"
        title={personName(detail.learner)}
        subtitle={`${detail.assignment.title} / Lần nộp #${detail.submissionNumber}`}
        back
        actions={
          canGrade && (
            <InstructorButton
              type="primary"
              icon={<EditOutlined />}
              onClick={() =>
                navigate(`/instructor/submissions/${detail.id}/grade`)
              }
            >
              Chấm bài nộp
            </InstructorButton>
          )
        }
      />
      {!detail.isLatest && (
        <Alert
          type="info"
          showIcon
          message="Bài nộp này đã được thay bằng một bài mới hơn. Chỉ bài nộp mới nhất được tính vào điểm."
        />
      )}

      <div className="instructor-submission-detail-grid">
        <div className="instructor-submission-column">
          <SectionCard title="Bài làm của học viên">
            <div className="instructor-submission-status">
              <StatusTag tone={status.tone}>{status.label}</StatusTag>
              {reason && <span>{reason}</span>}
            </div>
            <p className="instructor-submission-meta">
              Nộp lúc {formatDateTime(detail.submittedAt)}
              {detail.learner.email ? ` / ${detail.learner.email}` : ""}
            </p>
            <div className="instructor-submission-body">
              {detail.content ? (
                <p>{detail.content}</p>
              ) : (
                <p className="instructor-submission-empty-text">
                  Không có bài làm dạng văn bản.
                </p>
              )}
            </div>
            {detail.file && <FileLink file={detail.file} />}
            {detail.finalScore !== null && (
              <div className="instructor-submission-final">
                <span>Điểm cuối cùng</span>
                <strong>{detail.finalScore}</strong>
                {detail.finalizationComment && (
                  <p>{detail.finalizationComment}</p>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Các lượt chấm">
            {detail.reviews.length === 0 ? (
              <p className="instructor-submission-empty-text">
                Chưa có lượt chấm nào.
              </p>
            ) : (
              detail.reviews.map((review) => (
                <div className="instructor-submission-review" key={review.id}>
                  <div className="instructor-submission-review-head">
                    <strong>{personName(review.reviewer)}</strong>
                    <span>{reviewerRoleLabel(review.reviewerRole)}</span>
                    <StatusTag tone={reviewStatusView(review.status).tone}>
                      {reviewStatusView(review.status).label}
                    </StatusTag>
                    <b>{review.score ?? "-"}</b>
                  </div>
                  {review.scores.length > 0 && (
                    <ul>
                      {detail.assignment.rubric.map((criterion) => {
                        const score = review.scores.find(
                          (item) => item.criterionId === criterion.id,
                        );
                        return (
                          <li key={criterion.id}>
                            <span>{criterion.name}</span>
                            <span>
                              {score?.points ?? "-"} / {criterion.maxPoints}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {review.comment && <p>{review.comment}</p>}
                </div>
              ))
            )}
            <InfoPanel title="Danh tính hiển thị">
              Giảng viên thấy đầy đủ danh tính của học viên làm bài và của người
              chấm.
            </InfoPanel>
          </SectionCard>
        </div>

        <div className="instructor-submission-column">
          <SectionCard title="Assignment">
            <p className="instructor-submission-prompt">
              {detail.assignment.prompt ?? "Đề bài không có phần văn bản."}
            </p>
            {detail.assignment.promptFile && (
              <FileLink file={detail.assignment.promptFile} />
            )}
            <p className="instructor-submission-meta">
              Điểm đạt: {detail.assignment.passingScore} / 100
            </p>
            <div className="instructor-submission-rubric">
              {detail.assignment.rubric.map((criterion) => (
                <div key={criterion.id}>
                  <span>
                    <strong>{criterion.name}</strong>
                    <small>{criterion.description}</small>
                  </span>
                  <b>{criterion.maxPoints} điểm</b>
                </div>
              ))}
              <div className="instructor-submission-rubric-total">
                <span>Tổng</span>
                <b>{rubricMax} điểm</b>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Lịch sử nộp bài">
            <p className="instructor-submission-history-note">
              Bài nộp mới nhất quyết định điểm được ghi nhận.
            </p>
            {detail.history.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`instructor-submission-history${item.id === detail.id ? " is-current" : ""}`}
                onClick={() => navigate(`/instructor/submissions/${item.id}`)}
              >
                <strong>#{item.submissionNumber}</strong>
                <span>{formatDateTime(item.submittedAt)}</span>
                <StatusTag tone={gradingStatusView(item.gradingStatus).tone}>
                  {gradingStatusView(item.gradingStatus).label}
                </StatusTag>
              </button>
            ))}
          </SectionCard>
        </div>
      </div>
    </InstructorPage>
  );
};

export default SubmissionDetail;
