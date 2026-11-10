import { useEffect, useMemo, useState } from "react";
import { Alert, Input, InputNumber, Spin, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import FileLink from "@/components/instructor/submission.file.link";
import {
  getSubmissionDetailAPI,
  gradeSubmissionAPI,
} from "@/services/instructor.submission.service";
import type {
  IInstructorReviewResult,
  ISubmissionDetail,
} from "@/types/submission.types";
import {
  formatDateTime,
  gradingStatusView,
  interventionLabel,
  personName,
} from "@/utils/submission.labels";
import "./submissions.scss";

const COMMENT_MAX_LENGTH = 2000;

const roundScore = (value: number) => Math.round(value * 100) / 100;

const reasonGuide = (reason: string | null, peerScores: number[]) => {
  if (reason === "SCORE_GAP_EXCEEDED" && peerScores.length > 1) {
    const gap = roundScore(Math.max(...peerScores) - Math.min(...peerScores));
    return `Điểm của các người chấm chéo là ${peerScores.join(", ")}, chênh nhau ${gap} điểm. Điểm bạn chấm được lấy trung bình cùng các điểm đó để gợi ý điểm cuối cùng.`;
  }
  if (
    reason === "REVIEWER_MISSED_DEADLINE" ||
    reason === "REVIEWER_DEACTIVATED"
  ) {
    return "Điểm bạn chấm thay cho lượt chấm chéo còn thiếu và được lấy trung bình cùng các lượt đã chấm.";
  }
  if (peerScores.length > 0) {
    return "Điểm bạn chấm được lấy trung bình cùng các lượt chấm chéo đã xong để gợi ý điểm cuối cùng.";
  }
  return "Chưa có lượt chấm chéo nào xong, nên điểm bạn chấm là điểm cuối cùng được gợi ý.";
};

const SubmissionGrade = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ISubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<Record<string, number | null>>({});
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const rubric = useMemo(() => detail?.assignment.rubric ?? [], [detail]);
  const peerScores = useMemo(
    () =>
      (detail?.reviews ?? [])
        .filter(
          (review) => review.status === "Completed" && review.score !== null,
        )
        .map((review) => review.score as number),
    [detail],
  );

  const possible = rubric.reduce(
    (sum, criterion) => sum + criterion.maxPoints,
    0,
  );
  const earned = rubric.reduce(
    (sum, criterion) => sum + (points[criterion.id] ?? 0),
    0,
  );
  const complete =
    rubric.length > 0 &&
    rubric.every((criterion) => typeof points[criterion.id] === "number");
  const hasComment = comment.trim().length > 0;
  const score = possible > 0 ? roundScore((earned / possible) * 100) : 0;
  const suggested = roundScore(
    [...peerScores, score].reduce((sum, value) => sum + value, 0) /
      (peerScores.length + 1),
  );

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
          eyebrow="Bài nộp / Chấm điểm"
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
  const gradable =
    detail.isLatest && detail.gradingStatus === "AwaitingInstructor";
  const backToDetail = () => navigate(`/instructor/submissions/${detail.id}`);

  const handleSubmit = async () => {
    if (!complete) {
      message.warning("Hãy cho điểm mọi tiêu chí chấm.");
      return;
    }
    if (!hasComment) {
      message.warning("Hãy viết nhận xét chung cho học viên.");
      return;
    }
    setSubmitting(true);
    try {
      const res = (await gradeSubmissionAPI(detail.id, {
        scores: rubric.map((criterion) => ({
          criterionId: criterion.id,
          points: points[criterion.id] as number,
        })),
        comment: comment.trim(),
      })) as unknown as IBackendRes<IInstructorReviewResult>;
      if (res.data) {
        message.success(
          `Đã chấm bài. Điểm cuối cùng gợi ý: ${res.data.suggestedScore} / 100.`,
        );
        backToDetail();
      } else {
        message.error(
          typeof res.message === "string"
            ? res.message
            : "Không lưu được điểm.",
        );
      }
    } catch {
      message.error("Không kết nối được với máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="Bài nộp / Chấm điểm"
        title={`Chấm bài của ${personName(detail.learner)}`}
        subtitle={`${detail.assignment.title} / Lần nộp #${detail.submissionNumber}`}
        back
      />

      {!gradable && (
        <Alert
          type="info"
          showIcon
          message={
            detail.isLatest
              ? `Bài nộp này đang ở trạng thái "${status.label}" nên không chờ bạn chấm.`
              : "Bài nộp này đã được thay bằng một bài mới hơn. Chỉ chấm được bài nộp mới nhất."
          }
          action={
            <InstructorButton onClick={backToDetail}>
              Xem bài nộp
            </InstructorButton>
          }
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
          </SectionCard>

          <SectionCard title="Vì sao bạn chấm bài này">
            <WarningPanel title={reason ?? "Giảng viên chấm bài"}>
              {reasonGuide(detail.interventionReason, peerScores)}
            </WarningPanel>
            {peerScores.length > 0 && (
              <div className="instructor-grade-peers">
                {detail.reviews
                  .filter((review) => review.status === "Completed")
                  .map((review) => (
                    <div key={review.id}>
                      <span>{personName(review.reviewer)}</span>
                      <b>{review.score ?? "-"} / 100</b>
                    </div>
                  ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="instructor-submission-column">
          <SectionCard title="Chấm theo tiêu chí">
            {rubric.length === 0 ? (
              <p className="instructor-submission-empty-text">
                Bài tập này chưa có tiêu chí chấm.
              </p>
            ) : (
              <div className="instructor-submission-grade-form">
                {rubric.map((criterion) => (
                  <div className="instructor-grade-field" key={criterion.id}>
                    <label>
                      {criterion.name}
                      <small> / {criterion.maxPoints} điểm</small>
                    </label>
                    {criterion.description && (
                      <p className="instructor-grade-reason">
                        {criterion.description}
                      </p>
                    )}
                    <InputNumber
                      style={{ width: "100%" }}
                      placeholder={`0 - ${criterion.maxPoints}`}
                      min={0}
                      max={criterion.maxPoints}
                      precision={0}
                      disabled={!gradable}
                      value={points[criterion.id] ?? undefined}
                      onChange={(value) =>
                        setPoints((prev) => ({
                          ...prev,
                          [criterion.id]:
                            typeof value === "number" ? value : null,
                        }))
                      }
                    />
                  </div>
                ))}

                <div className="instructor-grade-field">
                  <label>
                    Nhận xét cho học viên
                    <small> / bắt buộc</small>
                  </label>
                  <Input.TextArea
                    rows={4}
                    placeholder="Nêu điểm mạnh và những điều cần cải thiện."
                    status={
                      gradable && complete && !hasComment
                        ? "warning"
                        : undefined
                    }
                    maxLength={COMMENT_MAX_LENGTH}
                    showCount
                    disabled={!gradable}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </div>

                <div className="instructor-grade-summary">
                  <div>
                    <span>Tổng điểm theo tiêu chí</span>
                    <strong>
                      {earned} / {possible} điểm
                    </strong>
                  </div>
                  <div>
                    <span>Điểm bạn chấm</span>
                    <strong>{complete ? score : "-"} / 100</strong>
                  </div>
                  <div>
                    <span>Điểm cuối cùng gợi ý</span>
                    <strong>{complete ? suggested : "-"} / 100</strong>
                  </div>
                </div>

                <InfoPanel title="Sau khi chấm">
                  Bài nộp chuyển sang "Chờ chốt điểm". Điểm cuối cùng chỉ được
                  ghi nhận khi bạn chốt điểm.
                </InfoPanel>

                <div className="instructor-grade-actions">
                  <InstructorButton onClick={backToDetail}>
                    Hủy
                  </InstructorButton>
                  <InstructorButton
                    type="primary"
                    loading={submitting}
                    disabled={!gradable || !complete || !hasComment}
                    onClick={handleSubmit}
                  >
                    Gửi điểm
                  </InstructorButton>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </InstructorPage>
  );
};

export default SubmissionGrade;
