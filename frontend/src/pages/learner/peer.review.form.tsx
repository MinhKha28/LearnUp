import { useCallback, useEffect, useState } from "react";
import { Input, InputNumber, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  InfoPanel,
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatusTag,
} from "@/components/learner/learner.ui";
import {
  assessmentErrorCode,
  downloadLearnerPromptFileAPI,
  downloadLearnerReviewFileAPI,
  fetchLearnerPeerReviewAPI,
  giveLearnerPeerReviewAPI,
  vietnameseErrorText,
} from "@/services/assessment.service";
import type { ILearnerReviewDetail } from "@/types/assessment.types";
import "./peer.review.form.scss";

const COMMENT_MAX_LENGTH = 2000;

const formatTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN") : "-";

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * UC31.1 - the Learner reviews one assigned submission against the Rubric: a whole-number score for every criterion and a
 * general comment (BR-257), before the deadline of the cycle. The work comes without its author (BR-233). A review that was
 * given is final, so it is shown here as it was given.
 */
const PeerReviewForm = () => {
  const { reviewId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ILearnerReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLearnerPeerReviewAPI(reviewId);
      if (res.data) {
        setDetail(res.data);
        setNotice("");
        setScores(
          Object.fromEntries(
            res.data.assignment.rubric.map((criterion) => [
              criterion.id,
              res.data?.myReview?.scores.find(
                (score) => score.criterionId === criterion.id,
              )?.points ?? null,
            ]),
          ),
        );
        setComment(res.data.myReview?.comment ?? "");
      } else {
        setDetail(null);
        setNotice(
          assessmentErrorCode(res).code === "REVIEW_NOT_FOUND"
            ? "Bài chấm này có thể đã bị xóa hoặc không phải của bạn."
            : vietnameseErrorText(res, "Không thể tải bài chấm này."),
        );
      }
    } catch {
      setDetail(null);
      setNotice("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = () => navigate("/learner/peer-review");

  if (loading) {
    return (
      <LearnerPage className="peer-review-form">
        <PageHeader
          eyebrow="CHẤM CHÉO / BÀI ĐƯỢC GIAO"
          title="Đang tải bài chấm..."
          subtitle=""
          back
        />
      </LearnerPage>
    );
  }

  if (!detail) {
    return (
      <LearnerPage className="peer-review-form">
        <PageHeader
          eyebrow="CHẤM CHÉO / BÀI ĐƯỢC GIAO"
          title="Không xem được bài chấm"
          subtitle={notice}
          back
        />
        <LearnerButton onClick={() => void load()}>Thử lại</LearnerButton>{" "}
        <LearnerButton onClick={back}>Quay lại chấm chéo</LearnerButton>
      </LearnerPage>
    );
  }

  const isOpen = detail.state === "Open";
  const rubric = detail.assignment.rubric;

  const downloadWork = async () => {
    const blob = await downloadLearnerReviewFileAPI(detail.id);
    if (!blob || !detail.submission.file) {
      message.error("Không tải được tệp.");
      return;
    }
    saveBlob(blob, detail.submission.file.fileName);
  };

  const downloadPrompt = async () => {
    const blob = await downloadLearnerPromptFileAPI(detail.assignmentId);
    if (!blob) {
      message.error("Không tải được tệp.");
      return;
    }
    saveBlob(blob, detail.assignment.promptFileName ?? "prompt.pdf");
  };

  const submit = async () => {
    if (saving) return;
    if (rubric.some((criterion) => scores[criterion.id] === null)) {
      message.warning("Hãy chấm điểm cho từng tiêu chí trước khi gửi.");
      return;
    }
    if (!comment.trim()) {
      message.warning("Hãy viết nhận xét chung trước khi gửi.");
      return;
    }
    setSaving(true);
    try {
      const res = await giveLearnerPeerReviewAPI(detail.id, {
        scores: rubric.map((criterion) => ({
          criterionId: criterion.id,
          points: scores[criterion.id] as number,
        })),
        comment: comment.trim(),
      });
      if (res.data) {
        message.success("Đã gửi nhận xét.");
        back();
        return;
      }
      const { code } = assessmentErrorCode(res);
      if (code === "REVIEW_ALREADY_GIVEN") {
        message.info("Bài chấm này đã được gửi trước đó.");
        await load();
      } else if (code === "REVIEW_CLOSED") {
        message.warning(
          "Đã quá hạn chấm bài này nên không thể gửi nữa.",
        );
        await load();
      } else {
        message.error(vietnameseErrorText(res, "Không thể gửi nhận xét."));
      }
    } catch {
      message.error("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <LearnerPage className="peer-review-form">
      <PageHeader
        eyebrow="CHẤM CHÉO / BÀI ĐƯỢC GIAO"
        title={`Chấm bài: ${detail.assignmentTitle}`}
        subtitle={`Hạn ${formatTime(detail.reviewDueAt)}`}
        back
      />
      <div className="peer-review-form-body">
        <div className="peer-review-submission-card">
          <h3>Bài nộp ẩn danh</h3>
          <StatusTag tone="neutral">Đã ẩn tác giả</StatusTag>
          {detail.assignment.prompt && (
            <>
              <span className="peer-review-submission-label">Đề bài</span>
              <p>{detail.assignment.prompt}</p>
              {detail.assignment.promptFileUrl && (
                <div className="peer-review-attachment">
                  <button type="button" onClick={() => void downloadPrompt()}>
                    Tải tệp đề bài
                  </button>
                </div>
              )}
            </>
          )}
          <span className="peer-review-submission-label">
            Bài làm đã nộp
          </span>
          <p>{detail.submission.content || "Không có nội dung văn bản."}</p>
          {detail.submission.file && (
            <>
              <hr />
              <span className="peer-review-submission-label">
                Tệp đính kèm
              </span>
              <div className="peer-review-attachment">
                <button type="button" onClick={() => void downloadWork()}>
                  Tải bài làm đã nộp ({detail.submission.file.fileName})
                </button>
              </div>
            </>
          )}
        </div>
        <div className="peer-review-score-card">
          <h3>Chấm điểm theo Rubric</h3>
          {detail.state === "Closed" && (
            <InfoPanel title="Đã đóng">
              Đã quá hạn chấm bài này nên không thể gửi nữa. Instructor sẽ
              chấm bài nộp.
            </InfoPanel>
          )}
          {rubric.map((criterion) => (
            <div className="peer-review-criterion" key={criterion.id}>
              <span>
                {criterion.name} (0 đến {criterion.maxPoints})
              </span>
              {criterion.description && <small>{criterion.description}</small>}
              <InputNumber
                aria-label={`Điểm cho ${criterion.name}`}
                min={0}
                max={criterion.maxPoints}
                precision={0}
                step={1}
                placeholder="Điểm"
                value={scores[criterion.id]}
                disabled={!isOpen || saving}
                onChange={(value) =>
                  setScores((previous) => ({
                    ...previous,
                    [criterion.id]: value,
                  }))
                }
              />
            </div>
          ))}
          <div className="peer-review-feedback">
            <span>Nhận xét</span>
            <Input.TextArea
              rows={4}
              maxLength={COMMENT_MAX_LENGTH}
              showCount
              placeholder="Viết nhận xét cụ thể..."
              value={comment}
              disabled={!isOpen || saving}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          {detail.state === "Done" ? (
            <p className="peer-review-completed-note">
              Đã chấm lúc {formatTime(detail.completedAt)}
              {detail.score !== null ? ` (điểm ${detail.score}/100)` : ""}.
              Không thể sửa nhận xét này nữa.
            </p>
          ) : (
            isOpen && (
              <div className="peer-review-form-actions">
                <LearnerButton
                  type="primary"
                  loading={saving}
                  onClick={() => void submit()}
                >
                  Gửi nhận xét
                </LearnerButton>
              </div>
            )
          )}
        </div>
      </div>
    </LearnerPage>
  );
};

export default PeerReviewForm;
