import { formatDateTimeVN } from "@/utils/helper";
import { useCallback, useEffect, useState } from "react";
import { Pagination } from "antd";
import { useNavigate } from "react-router-dom";
import {
  InfoPanel,
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatusTag,
} from "@/components/learner/learner.ui";
import {
  fetchLearnerPeerReviewsAPI,
  vietnameseErrorText,
} from "@/services/assessment.service";
import type {
  ILearnerReviewItem,
  ILearnerReviewList,
  TLearnerReviewState,
} from "@/types/assessment.types";
import "./peer.review.queue.scss";
import { vietnamesePageItem } from "@/components/vietnamese.controls";

const STATE_VIEW: Record<
  TLearnerReviewState,
  { label: string; tone: "info" | "success" | "neutral"; action: string }
> = {
  Open: { label: "Cần chấm", tone: "info", action: "Bắt đầu chấm" },
  Done: { label: "Đã chấm", tone: "success", action: "Xem nhận xét" },
  Closed: { label: "Đã đóng", tone: "neutral", action: "Xem" },
};

const PAGE_SIZE = 20;

const formatTime = (iso: string | null) => formatDateTimeVN(iso);

/** What the Learner calls a review without knowing the author: the end of its id, like the other anonymous labels. */
const reviewLabel = (item: ILearnerReviewItem) =>
  `Bài nộp ${item.id.slice(-4).toUpperCase()}`;

/**
 * UC31 - the reviews the system handed out to the Learner, with the deadline of the cycle (BR-229). The number still to
 * give is the first thing on the page (BR-232). The author of the work is not shown (BR-233).
 */
const PeerReviewQueue = () => {
  const navigate = useNavigate();
  const [list, setList] = useState<ILearnerReviewList | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLearnerPeerReviewsAPI(page, PAGE_SIZE);
      if (res.data) {
        setList(res.data);
        setNotice("");
      } else {
        setList(null);
        setNotice(
          vietnameseErrorText(
            res,
            "Không thể tải danh sách chấm chéo của bạn.",
          ),
        );
      }
    } catch {
      setList(null);
      setNotice("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <LearnerPage className="peer-review-queue">
      <PageHeader
        eyebrow="HỌC VIÊN"
        title="Nhiệm vụ chấm chéo"
        subtitle="Chấm các bài nộp ẩn danh được giao cho bạn."
        actions={
          <LearnerButton
            onClick={() => navigate("/learner/peer-review/history")}
          >
            Lịch sử chấm
          </LearnerButton>
        }
      />
      {loading && <p className="peer-review-queue-footnote">Đang tải...</p>}
      {!loading && notice && (
        <InfoPanel title="Chưa xem được danh sách chấm chéo">
          {notice}{" "}
          <LearnerButton onClick={() => void load()}>Thử lại</LearnerButton>
        </InfoPanel>
      )}
      {list && (
        <>
          <InfoPanel title="Hạn chấm">
            {list.pendingCount > 0
              ? `Bạn còn ${list.pendingCount} bài cần chấm. `
              : "Hiện bạn không có bài nào cần chấm. "}
            Hạn của chu kỳ áp dụng chung cho mọi người chấm được phân công.
          </InfoPanel>
          <div className="peer-review-queue-card">
            <table className="peer-review-queue-table">
              <thead>
                <tr>
                  <th>Bài nộp được giao</th>
                  <th>Bài tập</th>
                  <th>Hạn chấm</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{reviewLabel(item)}</strong>
                    </td>
                    <td>{item.assignmentTitle}</td>
                    <td>{formatTime(item.reviewDueAt)}</td>
                    <td>
                      <StatusTag tone={STATE_VIEW[item.state].tone}>
                        {STATE_VIEW[item.state].label}
                      </StatusTag>
                    </td>
                    <td>
                      <LearnerButton
                        onClick={() =>
                          navigate(`/learner/peer-review/${item.id}`)
                        }
                      >
                        {STATE_VIEW[item.state].action}
                      </LearnerButton>
                    </td>
                  </tr>
                ))}
                {list.items.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      Hiện chưa có nhiệm vụ chấm chéo nào được giao cho bạn.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {list.total > list.pageSize && (
              <Pagination itemRender={vietnamesePageItem}
                className="peer-review-queue-pagination"
                current={list.page}
                pageSize={list.pageSize}
                total={list.total}
                showSizeChanger={false}
                onChange={setPage}
              />
            )}
            <p className="peer-review-queue-footnote">
              Tên tác giả được ẩn với người chấm là học viên.
            </p>
          </div>
        </>
      )}
    </LearnerPage>
  );
};

export default PeerReviewQueue;
