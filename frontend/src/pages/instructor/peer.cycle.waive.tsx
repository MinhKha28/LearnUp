import { message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
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
  assessmentErrorCode,
  fetchPeerReviewCycleDetailAPI,
  waivePeerReviewDutyAPI,
} from "@/services/assessment.service";
import type { IPeerReviewCycleDetail } from "@/types/assessment.types";
import "./peer.cycles.scss";

/**
 * UC33.2 - the Instructor waives the peer review duty of one Learner who owes it (BR-241). The screen asks again before
 * it does it, because the Learner is told by e-mail and the duty cannot be given back.
 */
const PeerCycleWaive = () => {
  const { assignmentId = "", cycleId = "", learnerId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<IPeerReviewCycleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const back = `/instructor/peer-cycles/${assignmentId}/${cycleId}`;

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

  const reviewer = detail?.reviewers.find((row) => row.learnerId === learnerId);

  const confirm = async () => {
    setSaving(true);
    try {
      const res = await waivePeerReviewDutyAPI(assignmentId, learnerId);
      if (res.data) {
        if (res.data.alreadyWaived)
          message.info("Nghĩa vụ này đã được miễn trước đó.");
        else
          message.success(
            "Đã miễn nghĩa vụ chấm chéo. Học viên đã được thông báo.",
          );
        navigate(back);
        return;
      }
      if (assessmentErrorCode(res).code === "NOT_OWING_PEER_REVIEW") {
        message.warning(
          "Học viên này không còn nghĩa vụ chấm chéo nên không có gì để miễn.",
        );
        navigate(back);
        return;
      }
      message.error(cycleErrorText(res, "Không thể miễn nghĩa vụ này."));
    } catch {
      message.error("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <InstructorPage className="instructor-peer-cycles">
        <PageHeader
          eyebrow="Chu kỳ chấm chéo / Nghĩa vụ"
          title="Miễn nghĩa vụ chấm chéo"
          subtitle="Đang tải..."
          back
        />
        <p className="peer-cycles-empty">Đang tải...</p>
      </InstructorPage>
    );
  }

  if (!detail || !reviewer) {
    return (
      <InstructorPage className="instructor-peer-cycles">
        <PageHeader
          eyebrow="Chu kỳ chấm chéo / Nghĩa vụ"
          title="Không tìm thấy người chấm"
          subtitle={notice || "Nghĩa vụ chấm chéo này có thể đã bị xóa."}
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/peer-cycles")}>
          Quay lại danh sách chu kỳ
        </InstructorButton>
      </InstructorPage>
    );
  }

  const name = learnerLabel(reviewer.fullName, reviewer.learnerId);
  return (
    <InstructorPage className="instructor-peer-cycles">
      <PageHeader
        eyebrow="Chu kỳ chấm chéo / Nghĩa vụ"
        title="Miễn nghĩa vụ chấm chéo"
        subtitle="Dùng khi không thể yêu cầu học viên chấm bù."
        back
      />
      <SectionCard className="instructor-waive-card">
        <h2>Học viên: {name}</h2>
        <p>Bài tập: {detail.title}</p>
        <p>
          Số bài đã chấm trong chu kỳ này: {reviewer.completed}/
          {reviewer.assigned}
        </p>
        {reviewer.canWaive ? (
          <>
            <WarningPanel title="Trước khi xác nhận">
              Bạn có thể miễn nghĩa vụ đã bỏ lỡ vào bất kỳ lúc nào (BR-241),
              ví dụ khi quá hạn vì tổ chức bị tạm ngừng. Học viên nộp lại bài
              vẫn có thể chấm bù trong chu kỳ đang mở (BR-239). Học viên được
              thông báo trong ứng dụng và qua e-mail, và nghĩa vụ này sẽ được
              tính là đã đáp ứng khi xét hoàn thành.
            </WarningPanel>
            <div className="instructor-waive-actions">
              <InstructorButton
                type="primary"
                loading={saving}
                onClick={() => void confirm()}
              >
                Xác nhận miễn
              </InstructorButton>
              <InstructorButton onClick={() => navigate(back)}>
                Hủy
              </InstructorButton>
            </div>
          </>
        ) : (
          <>
            <WarningPanel title="Không có gì để miễn">
              {reviewer.obligation === "Waived"
                ? "Nghĩa vụ này đã được miễn."
                : "Học viên này hiện không có nghĩa vụ chấm chéo ở bài tập này (đã chấm xong hoặc vẫn còn hạn)."}
            </WarningPanel>
            <div className="instructor-waive-actions">
              <InstructorButton onClick={() => navigate(back)}>
                Quay lại chu kỳ
              </InstructorButton>
            </div>
          </>
        )}
      </SectionCard>
    </InstructorPage>
  );
};

export default PeerCycleWaive;
