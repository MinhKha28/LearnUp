import { formatPercentageVN } from "@/utils/number.format";
import { formatDateTimeVN } from "@/utils/helper";
import { useCallback, useEffect, useState } from "react";
import { Spin } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatCard,
  StatusTag,
  WarningPanel,
} from "@/components/learner/learner.ui";
import {
  assessmentErrorCode,
  fetchQuizHistoryAPI,
} from "@/services/assessment.service";
import type { IQuizHistory, IQuizHistoryItem } from "@/types/assessment.types";
import { quizErrorText } from "@/utils/quiz.take";
import "./quiz.history.scss";
import { VietnameseAlert } from "@/components/vietnamese.controls";

/** How the attempt was submitted, in words the Learner uses. */
export const submissionKindLabel = (item: IQuizHistoryItem) => {
  if (item.status === "InProgress") return "Đang làm";
  return item.submissionKind === "TimedOut" ? "Hết giờ, tự nộp" : "Bạn nộp";
};

/** UC29.2 — the attempts the Learner has done on a Quiz, with the score of each and the lock. */
const QuizHistory = () => {
  const { enrollmentId = "", quizId = "" } = useParams();
  const navigate = useNavigate();
  const base = `/learner/courses/${encodeURIComponent(enrollmentId)}`;
  const [history, setHistory] = useState<IQuizHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchQuizHistoryAPI(quizId);
      // The axios interceptor resolves HTTP errors too, so only res.data tells success apart.
      if (res.data) setHistory(res.data);
      else
        setError(
          quizErrorText(
            assessmentErrorCode(res).code,
            "Không tải được lịch sử làm bài.",
          ),
        );
    } catch {
      setError("Không kết nối được với máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !history) {
    return (
      <LearnerPage className="quiz-history">
        <Spin />
      </LearnerPage>
    );
  }
  if (!history) {
    return (
      <LearnerPage className="quiz-history">
        <PageHeader
          eyebrow="Bài đánh giá / Lịch sử làm bài"
          title="Lịch sử làm bài"
          subtitle=""
          back
        />
        <VietnameseAlert type="error" showIcon message={error} />
        <LearnerButton onClick={() => void load()}>Thử lại</LearnerButton>
      </LearnerPage>
    );
  }

  const { attempts } = history;
  const locked = attempts.lockedUntil !== null;
  return (
    <>
      <PageHeader
        eyebrow="Bài đánh giá / Lịch sử làm bài"
        title="Lịch sử làm bài"
        subtitle={`Các lượt làm: “${history.title}”`}
        back
      />
      <div className="course-learning-content">
        {locked && (
          <WarningPanel title="Bài trắc nghiệm đang tạm khóa">
            Bạn đã làm đủ {attempts.maxConsecutiveAttempts} lượt liên tiếp. Bạn
            làm lại được từ{" "}
            <strong>{formatDateTimeVN(attempts.lockedUntil!)}</strong>.
          </WarningPanel>
        )}
        <div className="quiz-history-summary">
          <StatCard
            label="Điểm được ghi nhận"
            value={
              history.recordedScore === null
                ? "Chưa có lượt nào được nộp"
                : `${formatPercentageVN(history.recordedScore)} (lượt có điểm cao nhất) · ${history.passed ? "Đạt" : "Chưa đạt"}`
            }
          />
          <StatCard
            label="Số lượt còn lại trước khi tạm khóa"
            value={
              locked
                ? `${attempts.remainingAttempts}/${attempts.maxConsecutiveAttempts} · mở lại ${formatDateTimeVN(attempts.lockedUntil!)}`
                : `${attempts.remainingAttempts}/${attempts.maxConsecutiveAttempts}`
            }
          />
        </div>
        <div className="quiz-history-table-card">
          <h3>Các lượt đã làm</h3>
          <table className="quiz-history-table">
            <thead>
              <tr>
                <th>Lượt</th>
                <th>Bắt đầu</th>
                <th>Nộp lúc</th>
                <th>Cách nộp</th>
                <th>Điểm</th>
                <th>Số câu đúng</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {history.items.map((item) => (
                <tr key={item.attemptId}>
                  <td>
                    <strong>Lượt {item.attemptNumber}</strong>
                    {item.isRecorded && (
                      <StatusTag tone="success">Được ghi nhận</StatusTag>
                    )}
                  </td>
                  <td>{formatDateTimeVN(item.startedAt)}</td>
                  <td>
                    {item.submittedAt ? formatDateTimeVN(item.submittedAt) : "-"}
                  </td>
                  <td>{submissionKindLabel(item)}</td>
                  <td>{item.score === null ? "-" : `${formatPercentageVN(item.score)}`}</td>
                  <td>
                    {item.correctCount === null
                      ? "-"
                      : `${item.correctCount}/${item.totalQuestions}`}
                  </td>
                  <td>
                    {item.passed === null
                      ? "-"
                      : item.passed
                        ? "Đạt"
                        : "Chưa đạt"}
                  </td>
                </tr>
              ))}
              {history.items.length === 0 && (
                <tr>
                  <td colSpan={7}>Bạn chưa làm lượt nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="quiz-result-actions">
          {!history.readOnly && !locked && (
            <LearnerButton
              type="primary"
              onClick={() => navigate(`${base}/quizzes/${quizId}`)}
            >
              {history.items.some((i) => i.status === "InProgress")
                ? "Tiếp tục làm bài"
                : "Bắt đầu làm bài"}
            </LearnerButton>
          )}
          <LearnerButton onClick={() => navigate(`${base}/assessments`)}>
            Quay lại danh sách bài đánh giá
          </LearnerButton>
        </div>
      </div>
    </>
  );
};

export default QuizHistory;
