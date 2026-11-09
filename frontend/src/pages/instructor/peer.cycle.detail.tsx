import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DetailItem,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import {
  cycleErrorText,
  learnerLabel,
} from "@/components/instructor/peer.cycle.format";
import {
  fetchPeerReviewCycleDetailAPI,
} from "@/services/assessment.service";
import type {
  IPeerReviewCycleDetail,
  TReviewerObligation,
} from "@/types/assessment.types";
import "./peer.cycles.scss";

const formatTime = (iso: string) => new Date(iso).toLocaleString("vi-VN");

/** Scores have at most two decimals (BR-202): 24.5 is written 24,5. */
const formatScore = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

const OBLIGATION_LABEL: Record<TReviewerObligation, string> = {
  Pending: "Đang thực hiện",
  Satisfied: "Đã hoàn thành",
  Missed: "Bỏ lỡ",
  Waived: "Đã miễn",
};

/**
 * UC33.1 - one cycle: the submissions with the reviews they got, and the Learners who have reviews to give with the state of
 * their duty. A duty that was missed can be waived from here (UC33.2).
 */
const PeerCycleDetail = () => {
  const { assignmentId = "", cycleId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<IPeerReviewCycleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPeerReviewCycleDetailAPI(assignmentId, cycleId);
      if (res.data) {
        setDetail(res.data);
        setNotice("");
      } else {
        setDetail(null);
        setNotice(cycleErrorText(res, "Không thể tải chu kỳ này."));
      }
    } catch {
      setDetail(null);
      setNotice("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId, cycleId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <InstructorPage className="instructor-peer-cycles">
        <PageHeader
          eyebrow="CHU KỲ CHẤM CHÉO / CHI TIẾT"
          title="Chi tiết chu kỳ chấm chéo"
          subtitle="Đang tải..."
          back
        />
        <p className="peer-cycles-empty">Đang tải chu kỳ...</p>
      </InstructorPage>
    );
  }

  if (!detail) {
    return (
      <InstructorPage className="instructor-peer-cycles">
        <PageHeader
          eyebrow="CHU KỲ CHẤM CHÉO / CHI TIẾT"
          title="Không xem được chu kỳ"
          subtitle={notice}
          back
        />
        <InstructorButton onClick={() => void load()}>
          Thử lại
        </InstructorButton>{" "}
        <InstructorButton onClick={() => navigate("/instructor/peer-cycles")}>
          Quay lại danh sách chu kỳ
        </InstructorButton>
      </InstructorPage>
    );
  }

  const { cycle } = detail;
  const flagged = detail.submissions.filter((row) => row.needsReview).length;
  return (
    <InstructorPage className="instructor-peer-cycles">
      <PageHeader
        eyebrow="CHU KỲ CHẤM CHÉO / CHI TIẾT"
        title="Chi tiết chu kỳ chấm chéo"
        subtitle={detail.title}
        back
      />
      <SectionCard className="instructor-cycle-meta-card">
        <div className="instructor-cycle-meta-grid">
          <DetailItem label="MỞ">{formatTime(cycle.opensAt)}</DetailItem>
          <DetailItem label="ĐÓNG VÀ PHÂN CÔNG">
            {formatTime(cycle.closesAt)}
          </DetailItem>
          <DetailItem label="HẠN CHẤM">
            {formatTime(cycle.reviewDueAt)}
          </DetailItem>
        </div>
      </SectionCard>
      <div className="instructor-cycle-detail-grid">
        <SectionCard title="Bài nộp trong chu kỳ">
          <div className="instructor-cycle-table">
            <div className="instructor-cycle-row instructor-cycle-row-submissions instructor-cycle-head">
              <span>Bài nộp</span>
              <span>Lượt chấm</span>
              <span>Còn thiếu</span>
              <span>Chênh lệch điểm</span>
            </div>
            {detail.submissions.map((row) => (
              <div
                className="instructor-cycle-row instructor-cycle-row-submissions"
                key={row.id}
              >
                <strong>{learnerLabel(row.fullName, row.learnerId)}</strong>
                <span>
                  {row.reviewsCompleted}/{row.reviewsAssigned}
                </span>
                <span>{row.reviewsMissing}</span>
                <span className="instructor-cycle-obligation">
                  {row.scoreGap === null ? "-" : formatScore.format(row.scoreGap)}
                  {row.needsReview && (
                    <span className="instructor-cycle-chip instructor-cycle-chip-Missed">
                      Cần xem lại
                    </span>
                  )}
                </span>
              </div>
            ))}
            {detail.submissions.length === 0 && (
              <div className="instructor-cycle-row instructor-cycle-row-submissions">
                <span>Chu kỳ này chưa có bài nộp.</span>
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          {flagged > 0 && (
            <p className="instructor-cycle-gap-note">
              {flagged} bài nộp có điểm của các người chấm chênh nhau hơn{" "}
              {formatScore.format(cycle.scoreGap)} điểm. Hãy xem lại và chốt điểm cuối (BR-252).
            </p>
          )}
        </SectionCard>
        <SectionCard title="Nghĩa vụ chấm chéo">
          <div className="instructor-cycle-table">
            <div className="instructor-cycle-row instructor-cycle-head">
              <span>Người chấm</span>
              <span>Được giao</span>
              <span>Đã chấm</span>
              <span>Nghĩa vụ</span>
            </div>
            {detail.reviewers.map((reviewer) => (
              <div className="instructor-cycle-row" key={reviewer.learnerId}>
                <strong>
                  {learnerLabel(reviewer.fullName, reviewer.learnerId)}
                </strong>
                <span>{reviewer.assigned}</span>
                <span>{reviewer.completed}</span>
                <span className="instructor-cycle-obligation">
                  <span
                    className={`instructor-cycle-chip instructor-cycle-chip-${reviewer.obligation}`}
                  >
                    {OBLIGATION_LABEL[reviewer.obligation]}
                  </span>
                  {reviewer.canWaive && (
                    <button
                      type="button"
                      className="instructor-cycle-waive-link"
                      onClick={() =>
                        navigate(
                          `/instructor/peer-cycles/${detail.assignmentId}/${cycle.id}/waive/${reviewer.learnerId}`,
                        )
                      }
                    >
                      Miễn
                    </button>
                  )}
                </span>
              </div>
            ))}
            {detail.reviewers.length === 0 && (
              <div className="instructor-cycle-row">
                <span>Chưa phân công người chấm.</span>
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </SectionCard>
      </div>
      <WarningPanel title="Can thiệp">
        Chấm trực tiếp các lượt chấm còn thiếu và xem lại các bài nộp có điểm
        chênh lệch.
      </WarningPanel>
    </InstructorPage>
  );
};

export default PeerCycleDetail;
