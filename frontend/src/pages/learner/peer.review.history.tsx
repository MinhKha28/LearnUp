import { useCallback, useEffect, useState } from "react";
import { Alert, Pagination, Select } from "antd";
import { useNavigate } from "react-router-dom";
import {
  InfoPanel,
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatusTag,
} from "@/components/learner/learner.ui";
import {
  fetchLearnerReviewHistoryAPI,
  vietnameseErrorText,
} from "@/services/assessment.service";
import type { IReviewHistory } from "@/types/assessment.types";
import { formatDateTimeVN } from "@/utils/helper";
import {
  criteriaLine,
  dutyLine,
  obligationView,
  progressText,
  reviewLabel,
  scoreText,
} from "@/utils/review.history";
import "./peer.review.history.scss";

const PAGE_SIZE = 20;

/**
 * UC31.2 - the reviews the Learner gave, with the score of each, and where their duty of peer review stands: for each
 * Assignment and as a whole. The duty is judged by the rule that decides the Certificate. The author of the work is
 * never shown (BR-233).
 */
const PeerReviewHistory = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<IReviewHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [assignmentId, setAssignmentId] = useState<string | undefined>(
    undefined,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLearnerReviewHistoryAPI(
        page,
        PAGE_SIZE,
        assignmentId,
      );
      // The axios interceptor resolves HTTP errors too, so only res.data tells success apart.
      if (res.data) {
        setHistory(res.data);
        setNotice("");
      } else {
        setHistory(null);
        setNotice(
          vietnameseErrorText(
            res,
            "Không tải được lịch sử chấm. Vui lòng thử lại.",
          ),
        );
      }
    } catch {
      setHistory(null);
      setNotice("Không kết nối được với máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [page, assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const header = (
    <PageHeader
      eyebrow="Chấm chéo / Lịch sử chấm"
      title="Lịch sử chấm của tôi"
      subtitle="Các bài chấm chéo bạn đã hoàn thành và tình trạng nghĩa vụ chấm."
      back
    />
  );

  if (!history) {
    return (
      <LearnerPage className="peer-review-history">
        {header}
        {notice ? (
          <>
            <Alert type="error" showIcon message={notice} />
            <LearnerButton onClick={() => void load()}>Thử lại</LearnerButton>
          </>
        ) : (
          <p>Đang tải...</p>
        )}
      </LearnerPage>
    );
  }

  const overall = obligationView(history.overall);
  return (
    <LearnerPage className="peer-review-history">
      {header}
      <div className="peer-review-history-obligation">
        <div>
          <span>Nghĩa vụ chấm chéo</span>
          <StatusTag tone={overall.tone}>{overall.label}</StatusTag>
        </div>
        <p>
          {history.assignedCount > 0 &&
            `${dutyLine(history.assignedCount, history.completedCount)} `}
          {overall.help}
        </p>
      </div>

      {history.obligations.length > 0 && (
        <div className="peer-review-history-card">
          <h3>Theo từng bài tập</h3>
          <ul className="peer-review-history-duties">
            {history.obligations.map((obligation) => {
              const view = obligationView(obligation.status);
              return (
                <li key={obligation.assignmentId}>
                  <strong>{obligation.assignmentTitle}</strong>
                  <span>{progressText(obligation)}</span>
                  <StatusTag tone={view.tone}>{view.label}</StatusTag>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="peer-review-history-card">
        <div className="peer-review-history-head">
          <h3>Các bài đã chấm</h3>
          {history.obligations.length > 1 && (
            <Select
              allowClear
              placeholder="Tất cả bài tập"
              aria-label="Lọc theo bài tập"
              style={{ minWidth: 220 }}
              value={assignmentId}
              onChange={(value) => {
                setAssignmentId(value);
                setPage(1);
              }}
              options={history.obligations.map((o) => ({
                value: o.assignmentId,
                label: o.assignmentTitle,
              }))}
            />
          )}
        </div>
        <table className="peer-review-history-table">
          <thead>
            <tr>
              <th>Bài nộp</th>
              <th>Bài tập</th>
              <th>Điểm đã chấm</th>
              <th>Ngày chấm</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {history.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{reviewLabel(item)}</strong>
                </td>
                <td>{item.assignmentTitle}</td>
                <td>
                  <strong>{scoreText(item.score)}</strong>/100
                  {item.criteria.length > 0 && (
                    <small className="peer-review-history-criteria">
                      {criteriaLine(item)}
                    </small>
                  )}
                </td>
                <td>{formatDateTimeVN(item.completedAt)}</td>
                <td>
                  <LearnerButton
                    onClick={() => navigate(`/learner/peer-review/${item.id}`)}
                  >
                    Xem nhận xét
                  </LearnerButton>
                </td>
              </tr>
            ))}
            {history.items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  {assignmentId
                    ? "Bạn chưa chấm bài nào của bài tập này."
                    : "Chưa có bài chấm chéo nào hoàn thành."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {history.total > PAGE_SIZE && (
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={history.total}
            showSizeChanger={false}
            disabled={loading}
            onChange={setPage}
          />
        )}
      </div>
      <InfoPanel title="Điều kiện đánh giá">
        Phải chấm xong các bài được giao của bài tập có chấm chéo, trước hạn của
        chu kỳ. Điểm bạn đã chấm là cuối cùng, không sửa lại được.
      </InfoPanel>
    </LearnerPage>
  );
};

export default PeerReviewHistory;
