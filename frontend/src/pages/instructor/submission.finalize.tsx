import { Alert, Button, Form, Input, Modal, Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import {
  finalizeSubmissionAPI,
  getSubmissionDetailAPI,
} from "@/services/instructor.submission.service";
import type {
  IFinalizeSubmissionPayload,
  IFinalizeSubmissionResult,
  ISubmissionDetail,
} from "@/types/submission.types";
import {
  formatDateTime,
  reviewerRoleLabel,
  reviewStatusView,
} from "@/utils/submission.labels";
import "./submissions.scss";

const SUBMISSIONS = "/instructor/submissions";
const COMMENT_REQUIRED =
  "Điểm cuối cùng khác điểm tổng hợp, vui lòng nhập nhận xét giải thích.";
const NOT_FOUND =
  "Không tìm thấy bài nộp này, hoặc bạn không phụ trách chấm bài này.";
const TEMPORARY_ERROR = "Không kết nối được với máy chủ. Vui lòng thử lại.";
const CONFLICT_MESSAGES = {
  SUBMISSION_ALREADY_FINALIZED: "Bài nộp này đã được chốt điểm.",
  SUBMISSION_NOT_LATEST:
    "Học viên đã nộp bài mới hơn. Chỉ chốt điểm được bài nộp mới nhất.",
  SUBMISSION_NOT_AWAITING_FINALIZATION:
    "Bài nộp chưa sẵn sàng để chốt điểm.",
  SUBMISSION_STATE_INCOMPLETE:
    "Dữ liệu chấm điểm chưa đầy đủ. Vui lòng tải lại trang hoặc liên hệ quản trị viên.",
} as const;

type ConflictCode = keyof typeof CONFLICT_MESSAGES;

const isConflictCode = (code: string): code is ConflictCode =>
  Object.hasOwn(CONFLICT_MESSAGES, code);

type ApiResponse<T> = {
  data?: T | null;
  statusCode?: number | string;
  error?: { code?: string } | null;
};

const blockedCode = (detail: ISubmissionDetail): ConflictCode | null => {
  if (detail.gradingStatus === "Finalized") return "SUBMISSION_ALREADY_FINALIZED";
  if (!detail.isLatest) return "SUBMISSION_NOT_LATEST";
  if (detail.gradingStatus !== "AwaitingFinalization")
    return "SUBMISSION_NOT_AWAITING_FINALIZATION";
  if (detail.aggregateScore == null) return "SUBMISSION_STATE_INCOMPLETE";
  return null;
};

const inaccessible = (res: ApiResponse<unknown>) =>
  [401, 403, 404].includes(Number(res.statusCode)) ||
  ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(res.error?.code ?? "");

const ReviewSummary = ({ reviews }: Pick<ISubmissionDetail, "reviews">) => (
  <SectionCard title="Các lượt chấm">
    {reviews.length === 0 && <p>Chưa có lượt chấm nào.</p>}
    {reviews.map((review) => {
      const status = reviewStatusView(review.status);
      return (
        <div className="instructor-submission-review" key={review.id}>
          <div className="instructor-submission-review-head">
            <strong>{review.reviewer.fullName ?? "Người chấm"}</strong>
            <span>{reviewerRoleLabel(review.reviewerRole)}</span>
            <StatusTag tone={status.tone}>{status.label}</StatusTag>
            {review.score !== null && <b>{review.score}/100</b>}
          </div>
          <p>{formatDateTime(review.completedAt)}</p>
          {review.comment && <p>{review.comment}</p>}
        </div>
      );
    })}
  </SectionCard>
);

const FinalizePage = ({ submissionId }: { submissionId: string }) => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ISubmissionDetail | null>(null);
  const [loadError, setLoadError] = useState<{ text: string; retry: boolean }>();
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [conflict, setConflict] = useState<ConflictCode>();
  const [score, setScore] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [scoreError, setScoreError] = useState<string>();
  const [commentError, setCommentError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [confirmation, setConfirmation] = useState<IFinalizeSubmissionPayload>();
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const detailPath = `${SUBMISSIONS}/${encodeURIComponent(submissionId)}`;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = (await getSubmissionDetailAPI(submissionId)) as unknown as
          ApiResponse<ISubmissionDetail>;
        if (!active) return;
        if (res.data) {
          setDetail(res.data);
          const aggregate = String(res.data.aggregateScore ?? "");
          setScore((value) => value ?? aggregate);
        } else {
          const missing = inaccessible(res) || Number(res.statusCode) === 400;
          setLoadError({
            text: missing ? NOT_FOUND : TEMPORARY_ERROR,
            retry: !missing,
          });
        }
      } catch {
        if (active) setLoadError({ text: TEMPORARY_ERROR, retry: true });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [submissionId, loadAttempt]);

  const reload = () => {
    setLoadError(undefined);
    setLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const blocked = (detail && blockedCode(detail)) ?? conflict;

  const prepare = () => {
    setScoreError(undefined);
    setCommentError(undefined);
    setSubmitError(undefined);
    const raw = (score ?? "").trim().replace(",", ".");
    const finalScore = Number(raw);
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || finalScore > 100) {
      setScoreError("Nhập điểm từ 0 đến 100 với tối đa 2 chữ số thập phân.");
      return;
    }
    const trimmed = comment.trim();
    if (trimmed.length > 2000) {
      setCommentError("Nhận xét chỉ được dài tối đa 2000 ký tự.");
      return;
    }
    if (
      detail?.aggregateScore != null &&
      Math.round(finalScore * 100) !== Math.round(detail.aggregateScore * 100) &&
      !trimmed
    ) {
      setCommentError(COMMENT_REQUIRED);
      return;
    }
    setConfirmation({ finalScore, ...(trimmed ? { comment: trimmed } : {}) });
  };

  const publish = async () => {
    if (!confirmation || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const res = (await finalizeSubmissionAPI(submissionId, confirmation)) as unknown as
        ApiResponse<IFinalizeSubmissionResult>;
      if (res.data) {
        navigate(detailPath, { replace: true });
        return;
      }
      const status = Number(res.statusCode);
      const code = res.error?.code ?? "";
      if (status === 400 && code === "FINALIZATION_COMMENT_REQUIRED") {
        setCommentError(COMMENT_REQUIRED);
      } else if (status === 409 && isConflictCode(code)) {
        setConflict(code);
        reload();
      } else if (inaccessible(res)) {
        setDetail(null);
        setLoadError({ text: NOT_FOUND, retry: false });
      } else {
        setSubmitError(TEMPORARY_ERROR);
      }
    } catch {
      setSubmitError(TEMPORARY_ERROR);
    } finally {
      setConfirmation(undefined);
      setSubmitting(false);
      inFlight.current = false;
    }
  };

  const learnerName = detail?.learner.fullName;
  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="Bài nộp / Chốt điểm"
        title="Chốt điểm bài tập"
        subtitle={detail && !loadError ? detail.assignment.title : "Kiểm tra và công bố kết quả bài nộp."}
      />
      <Link className="instructor-finalize-back" to={detail ? detailPath : SUBMISSIONS}>
        {detail ? "Về chi tiết bài nộp" : "Về danh sách bài nộp"}
      </Link>
      {loading ? (
        <Spin aria-label="Đang tải bài nộp" />
      ) : loadError || blocked ? (
        <Alert
          type={!loadError && blocked === "SUBMISSION_ALREADY_FINALIZED" ? "info" : "error"}
          showIcon
          message={loadError?.text ?? (blocked && CONFLICT_MESSAGES[blocked])}
          action={loadError?.retry && <Button onClick={reload}>Thử lại</Button>}
        />
      ) : detail ? (
        <>
          <SectionCard title={detail.learner.fullName ? `Học viên: ${learnerName}` : "Học viên"}>
            <div className="instructor-finalize-aggregate">
              <span>Điểm tổng hợp</span>
              <strong>{detail.aggregateScore}/100</strong>
            </div>
            <Form layout="vertical" onFinish={prepare}>
              <Form.Item
                label="Điểm cuối cùng"
                htmlFor="final-score"
                validateStatus={scoreError ? "error" : undefined}
                help={scoreError && <span id="final-score-error">{scoreError}</span>}
              >
                <Input
                  id="final-score"
                  inputMode="decimal"
                  value={score ?? ""}
                  aria-invalid={!!scoreError}
                  aria-describedby={scoreError ? "final-score-error" : undefined}
                  onChange={(event) => {
                    setScore(event.target.value);
                    setScoreError(undefined);
                  }}
                />
              </Form.Item>
              <Form.Item
                label="Nhận xét cho học viên"
                htmlFor="final-comment"
                validateStatus={commentError ? "error" : undefined}
                help={null}
              >
                <Input.TextArea
                  id="final-comment"
                  rows={4}
                  value={comment}
                  aria-invalid={!!commentError}
                  aria-describedby={commentError ? "final-comment-error" : undefined}
                  onChange={(event) => {
                    setComment(event.target.value);
                    setCommentError(undefined);
                  }}
                />
                {commentError && (
                  <p id="final-comment-error" className="instructor-finalize-field-error" role="alert">
                    {commentError}
                  </p>
                )}
              </Form.Item>
              {submitError && (
                <Alert type="error" showIcon message={submitError} />
              )}
              <div className="instructor-finalize-actions">
                <Button type="primary" htmlType="submit" disabled={submitting}>
                  {submitError ? "Thử lại" : "Công bố điểm cuối cùng"}
                </Button>
              </div>
            </Form>
          </SectionCard>
          <ReviewSummary reviews={detail.reviews} />
        </>
      ) : null}
      <Modal
        open={!!confirmation}
        title="Công bố điểm cuối cùng?"
        closable={false}
        keyboard={!submitting}
        maskClosable={false}
        onCancel={() => setConfirmation(undefined)}
        afterOpenChange={(open) => {
          if (open) cancelButton.current?.focus();
        }}
        footer={[
          <Button
            key="cancel"
            ref={cancelButton}
            disabled={submitting}
            onClick={() => setConfirmation(undefined)}
          >
            Hủy
          </Button>,
          <Button
            key="publish"
            type="primary"
            loading={submitting}
            disabled={submitting}
            onClick={publish}
          >
            Công bố điểm
          </Button>,
        ]}
      >
        Học viên{learnerName ? ` ${learnerName}` : ""} sẽ nhận điểm cuối cùng{" "}
        {confirmation?.finalScore}/100.
        Sau khi công bố, bạn không thể hoàn tác.
      </Modal>
    </InstructorPage>
  );
};

const SubmissionFinalize = () => {
  const { submissionId = "" } = useParams();
  return <FinalizePage key={submissionId} submissionId={submissionId} />;
};

export default SubmissionFinalize;
