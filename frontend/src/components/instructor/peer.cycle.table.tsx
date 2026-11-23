import { formatDateTimeVN } from "@/utils/helper";
import { useCallback, useEffect, useState } from "react";
import { message, Popconfirm } from "antd";
import { Link } from "react-router-dom";
import { InstructorButton } from "@/components/instructor/instructor.ui";
import {
  assessmentErrorCode,
  assessmentErrorText,
  closePeerReviewCycleAPI,
  fetchPeerReviewCyclesAPI,
} from "@/services/assessment.service";
import type { IPeerReviewCycleList, TPeerReviewCycleStatus } from "@/types/assessment.types";
import "./peer.cycle.table.scss";

const formatTime = (iso: string) => formatDateTimeVN(iso);

const STATUS_LABEL: Record<TPeerReviewCycleStatus, string> = {
  Open: "Đang mở",
  Assigned: "Đã phân công",
  InstructorOnly: "Giảng viên chấm",
  Completed: "Hoàn tất",
};

const STATUS_HINT: Record<TPeerReviewCycleStatus, string> = {
  Open: "Đang nhận bài nộp.",
  Assigned: "Đã đóng; các bài nộp đã được giao cho người chấm.",
  InstructorOnly: "Đã đóng nhưng có quá ít bài nộp để chấm chéo, nên bạn chấm tất cả.",
  Completed: "Mọi bài chấm đã xong.",
};

/**
 * UC33 - the cycles of one Assignment with their three dates, submissions and status. Shared by the Course Builder
 * (from an Assignment) and by the "Peer Cycles" page of the sidebar (a picked Assignment).
 */
const PeerCycleTable = ({
  assignmentId,
  onLoaded,
}: {
  assignmentId: string;
  /** Tells the page which Assignment it is showing. */
  onLoaded?: (list: IPeerReviewCycleList | null) => void;
}) => {
  const [list, setList] = useState<IPeerReviewCycleList | null>(null);
  const [loading, setLoading] = useState(true);
  // set when there is nothing to show: peer review is off, or the call failed
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [closingId, setClosingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let result: IPeerReviewCycleList | null = null;
    try {
      const res = await fetchPeerReviewCyclesAPI(assignmentId);
      if (res.data) {
        result = res.data;
        setNotice("");
      } else if (assessmentErrorCode(res).code === "PEER_REVIEW_NOT_ENABLED") {
        // PRE-1
        setNotice("Bài tập này chưa bật chấm chéo nên không có chu kỳ.");
      } else {
        setNotice(assessmentErrorText(res, "Không tải được các chu kỳ chấm chéo."));
      }
    } catch {
      setNotice("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setList(result);
      setLoading(false);
      onLoaded?.(result);
    }
  }, [assignmentId, onLoaded]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  /**
   * UC33: close a cycle whose closing line has passed but which the schedule has not closed yet. The backend hands out
   * the reviews or sends the work to the Instructor. Before the line the calendar closes it (BR-230), never this button.
   */
  const closeCycle = async (cycleId: string) => {
    setClosingId(cycleId);
    try {
      const res = await closePeerReviewCycleAPI(assignmentId, cycleId);
      if (!res.data) {
        message.error(assessmentErrorText(res, "Không đóng được chu kỳ."));
        return;
      }
      const done = res.data;
      if (done.alreadyClosed) message.info("Chu kỳ này đã được đóng từ trước.");
      else if (done.status === "Assigned")
        message.success(`Đã đóng chu kỳ. ${done.reviewCount} bài chấm đã được giao cho ${done.submissionCount} học viên.`);
      else message.success(`Đã đóng chu kỳ. Chỉ có ${done.submissionCount} bài nộp nên bạn chấm tất cả.`);
      setReloadKey((key) => key + 1);
    } catch {
      message.error("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setClosingId(null);
    }
  };

  if (loading) return <p className="peer-cycles-empty">Đang tải các chu kỳ...</p>;
  if (!list) {
    return (
      <div className="builder-banner">
        <strong>Không có chu kỳ để hiển thị</strong>
        <p>{notice}</p>
        <InstructorButton onClick={() => setReloadKey((key) => key + 1)}>Thử lại</InstructorButton>
      </div>
    );
  }

  const n = list.settings.reviewersPerSubmission;
  return (
    <>
      {list.items.length === 0 ? (
        <p className="peer-cycles-empty">
          Chưa có chu kỳ nào. Chu kỳ đầu tiên mở khi một học viên nộp bài cho bài tập này.
        </p>
      ) : (
        <table className="peer-cycles-table">
          <thead>
            <tr>
              <th>Chu kỳ</th>
              <th>Mở lúc</th>
              <th>Đóng và phân công</th>
              <th>Hạn chấm</th>
              <th>Bài nộp</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.items.map((cycle, index) => (
              <tr key={cycle.id}>
                <td>
                  <strong>Chu kỳ {index + 1}</strong>
                </td>
                <td>{formatTime(cycle.opensAt)}</td>
                <td>{formatTime(cycle.closesAt)}</td>
                <td>{formatTime(cycle.reviewDueAt)}</td>
                <td>{cycle.submissionCount}</td>
                <td>
                  <span className={`peer-cycles-status peer-cycles-status-${cycle.status}`} title={STATUS_HINT[cycle.status]}>
                    {STATUS_LABEL[cycle.status]}
                  </span>
                </td>
                <td>
                  {cycle.submissionCount > 0 && (
                    <Link className="peer-cycles-detail-link" to={`/instructor/peer-cycles/${assignmentId}/${cycle.id}`}>
                      Chi tiết
                    </Link>
                  )}{" "}
                  {!cycle.closed && Date.parse(cycle.closesAt) <= Date.now() && (
                    <Popconfirm
                      title="Đóng chu kỳ này ngay bây giờ?"
                      description={`Chu kỳ ${index + 1} đã qua giờ chốt và lịch chưa đóng nó. Đóng chu kỳ sẽ phân ${cycle.submissionCount} bài nộp để người học chấm chéo.`}
                      okText="Đóng chu kỳ"
                      onConfirm={() => closeCycle(cycle.id)}
                    >
                      <InstructorButton size="small" loading={closingId === cycle.id}>
                        Đóng chu kỳ
                      </InstructorButton>
                    </Popconfirm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="peer-cycles-footnote">
        Mỗi bài nộp có {n ?? "?"} người chấm. Nếu một chu kỳ có ít hơn {(n ?? 0) + 1} bài nộp thì bạn chấm tất cả.
        Đổi cấu hình chỉ áp dụng cho các chu kỳ tạo sau đó; chu kỳ đã tạo giữ nguyên thời hạn.
      </p>
    </>
  );
};

export default PeerCycleTable;
