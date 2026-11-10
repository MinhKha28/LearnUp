import { formatDateTimeVN } from "@/utils/helper";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader, SuccessScreen } from "@/components/learner/learner.ui";
import type { ISubmissionReceipt } from "@/types/assessment.types";

interface ISubmittedState {
  receipt?: ISubmissionReceipt;
  title?: string;
}

const formatTime = (iso: string) => formatDateTimeVN(iso);

const AssignmentSubmitted = () => {
  const { enrollmentId: courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { receipt, title } = (state ?? {}) as ISubmittedState;

  // Opened without having just submitted (a reload, a bookmark): nothing to confirm.
  if (!receipt) {
    return <Navigate to={`/learner/courses/${courseId}/assessments`} replace />;
  }

  const { attempts, cycle } = receipt;
  const resubmitted = receipt.replacedSubmissionId !== null;

  return (
    <>
      <PageHeader
        eyebrow="Bài trắc nghiệm và Bài tập / Đã nộp"
        title={resubmitted ? "Đã nộp lại Bài tập" : "Đã nộp Bài tập"}
        subtitle={title ? `${title} đang chờ được chấm.` : "Bài làm của bạn đang chờ được chấm."}
      />
      <SuccessScreen
        tone="success"
        title={resubmitted ? "Đã nhận bài nộp lại" : "Đã nhận bài nộp"}
        primary={{
          label: "Quay lại Bài trắc nghiệm và Bài tập",
          onClick: () => navigate(`/learner/courses/${courseId}/assessments`),
        }}
        secondary={{
          label: "Xem Bài tập",
          onClick: () => navigate(`/learner/courses/${courseId}/assignments/${assignmentId}`),
        }}
      >
        <p>Nộp lúc {formatTime(receipt.submittedAt)}.</p>
        {cycle ? (
          <p>
            {receipt.placement === "REPLACES_IN_CYCLE"
              ? "Bài này thay bài nộp trước của bạn trong chu kỳ chấm chéo đóng lúc "
              : "Bài này nằm trong chu kỳ chấm chéo đóng lúc "}
            {formatTime(cycle.closesAt)}. Hạn chấm bài là {formatTime(cycle.reviewDueAt)}.
          </p>
        ) : (
          <p>
            {resubmitted
              ? "Chu kỳ chấm chéo của bài nộp trước đã đóng, hoặc Bài tập không chấm chéo, nên giảng viên sẽ chấm trực tiếp bài này."
              : "Giảng viên sẽ chấm bài này."}
          </p>
        )}
        {attempts.lockedUntil ? (
          <p>
            Bạn đã dùng hết {attempts.maxConsecutiveAttempts} lần nộp liên tiếp. Bạn nộp lại được từ{" "}
            {formatTime(attempts.lockedUntil)}.
          </p>
        ) : (
          <p>
            Số lần nộp còn lại trước khi phải tạm dừng: {attempts.remainingAttempts}/{attempts.maxConsecutiveAttempts}.
          </p>
        )}
        <p>Bài nộp mới nhất của bạn sẽ được dùng làm kết quả của Bài tập.</p>
      </SuccessScreen>
    </>
  );
};

export default AssignmentSubmitted;
