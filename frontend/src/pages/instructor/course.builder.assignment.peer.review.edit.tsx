import { Switch, message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useOutletContext } from "react-router-dom";
import { NumberField } from "@/components/instructor/form.field";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, fetchAssignmentAPI, updatePeerReviewAPI } from "@/services/assessment.service";
import type { IAssignment } from "@/types/assessment.types";
import { PEER_DAYS_RULE, PEER_REVIEWERS_RULE, PEER_SCORE_GAP_RULE, validateNumber } from "@/utils/validation";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

// Defaults fixed in the business rules (BR-268). Display only: the API applies the Admin's current values.
const PLATFORM_DEFAULT_CYCLE_DAYS = 7;
const PLATFORM_DEFAULT_DEADLINE_DAYS = 3;

const CourseBuilderAssignmentPeerReviewEdit = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;

  const [assignment, setAssignment] = useState<IAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [reviewers, setReviewers] = useState<number | null>(null);
  const [cycleLength, setCycleLength] = useState<number | null>(null);
  const [reviewDeadline, setReviewDeadline] = useState<number | null>(null);
  const [threshold, setThreshold] = useState<number | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchAssignmentAPI(assignmentId);
        if (!active) return;
        const loaded = res.data;
        if (!loaded) {
          message.error(assessmentErrorText(res, "Không thể tải thông tin bài tập."));
          return;
        }
        setAssignment(loaded);
        setEnabled(loaded.peerReview.enabled);
        setReviewers(loaded.peerReview.reviewersPerSubmission);
        setCycleLength(loaded.peerReview.cycleDays);
        setReviewDeadline(loaded.peerReview.deadlineDays);
        setThreshold(loaded.peerReview.scoreGap);
      } catch {
        if (active) message.error("Không thể kết nối dịch vụ Đánh giá. Vui lòng thử lại.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [assignmentId]);


  const base = `/instructor/courses/${course.id}/builder`;

  if (!assignment) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Xây dựng khóa học / Thiết lập chấm chéo</span>
        <div className="builder-hero">
          <h1>{loading ? "Đang tải thiết lập chấm chéo..." : "Không tìm thấy bài tập"}</h1>
        </div>
        {!loading && <InstructorButton onClick={() => navigate(`${base}/assignments`)}>Quay lại</InstructorButton>}
      </InstructorPage>
    );
  }

  const detailPath = `${base}/assignments/${assignment.id}`;
  // BR-185: only the on/off switch is blocked once the Course is Locked; the parameters stay editable.
  const toggleLocked = assignment.courseLocked;

  // The fields are only used (and checked) while Peer Review is on.
  const errors = enabled
    ? [
        validateNumber(reviewers, PEER_REVIEWERS_RULE),
        validateNumber(cycleLength, PEER_DAYS_RULE),
        validateNumber(reviewDeadline, PEER_DAYS_RULE),
        validateNumber(threshold, PEER_SCORE_GAP_RULE),
      ]
    : [];

  const handleSave = async () => {
    setSubmitted(true);
    if (errors.some(Boolean)) {
      message.warning("Vui lòng kiểm tra các trường được đánh dấu.");
      requestAnimationFrame(() =>
        document
          .querySelector(".builder-field-error, .ant-input-number-status-error")
          ?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      return;
    }
    setSaving(true);
    try {
      const res = await updatePeerReviewAPI(
        assignment.id,
        enabled
          ? {
              enabled,
              reviewersPerSubmission: reviewers ?? undefined,
              cycleDays: cycleLength ?? undefined,
              deadlineDays: reviewDeadline ?? undefined,
              scoreGap: threshold ?? undefined,
            }
          : { enabled },
      );
      if (!res.data) {
        message.error(assessmentErrorText(res, "Không thể lưu thiết lập chấm chéo."));
        return;
      }
      message.success("Đã lưu thiết lập chấm chéo.");
      navigate(detailPath, { state: location.state });
    } catch {
      message.error("Không thể kết nối dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Xây dựng khóa học / Thiết lập chấm chéo</span>
      <div className="builder-hero">
        <h1>Thiết lập chấm chéo</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <div className="builder-actions-split" style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Bật chấm chéo</h2>
            <Switch checked={enabled} disabled={toggleLocked} onChange={setEnabled} />
          </div>

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label">Số người chấm cho mỗi bài nộp</label>
              <NumberField
                rule={PEER_REVIEWERS_RULE}
                disabled={!enabled}
                showError={submitted}
                value={reviewers}
                onChange={setReviewers}
              />
            </div>
            <div>
              <label className="instructor-form-label">Độ dài chu kỳ (ngày)</label>
              <NumberField
                rule={PEER_DAYS_RULE}
                placeholder="Mặc định hệ thống"
                disabled={!enabled}
                showError={submitted}
                value={cycleLength}
                onChange={setCycleLength}
              />
            </div>
            <div>
              <label className="instructor-form-label">Hạn chấm sau khi đóng chu kỳ (ngày)</label>
              <NumberField
                rule={PEER_DAYS_RULE}
                placeholder="Mặc định hệ thống"
                disabled={!enabled}
                showError={submitted}
                value={reviewDeadline}
                onChange={setReviewDeadline}
              />
            </div>
            <div>
              <label className="instructor-form-label">Ngưỡng chênh lệch điểm (0–100)</label>
              <NumberField
                rule={PEER_SCORE_GAP_RULE}
                disabled={!enabled}
                showError={submitted}
                value={threshold}
                onChange={setThreshold}
              />
            </div>
          </div>

          <InfoPanel title="Lịch chu kỳ">
            Hạn chấm bắt đầu từ khi chu kỳ chốt và phân công người chấm. Chọn chu kỳ đủ dài để thu thập ít nhất {reviewers && Number.isFinite(reviewers) ? reviewers + 1 : "số người chấm + 1"} bài nộp;
            nếu không đủ, giảng viên sẽ chấm trực tiếp bài nộp trong chu kỳ đó.
          </InfoPanel>

          <InfoPanel title="Giá trị mặc định hệ thống">
            Để trống độ dài chu kỳ hoặc hạn chấm để sử dụng mặc định của nền tảng: {PLATFORM_DEFAULT_CYCLE_DAYS} ngày cho chu kỳ và {PLATFORM_DEFAULT_DEADLINE_DAYS} ngày cho hạn chấm. Quản trị viên nền tảng quản lý các giá trị này; thay đổi chỉ áp dụng cho chu kỳ tạo mới, không ảnh hưởng chu kỳ đang chạy. Khi lưu, giá trị áp dụng được ghi nhận cho bài tập này.
          </InfoPanel>

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(detailPath, { state: location.state })}>Hủy</InstructorButton>
            <InstructorButton type="primary" loading={saving} onClick={handleSave}>
              Lưu thiết lập
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <div className="builder-banner" style={{ marginBottom: 0 }}>
            <strong>Quy tắc khi đã khóa</strong>
            <p>
              {toggleLocked
                ? "Khóa học đã khóa nên không thể bật hoặc tắt chấm chéo. Có thể thay đổi tham số nhưng chỉ áp dụng cho chu kỳ mới."
                : "Không thể bật hoặc tắt chấm chéo khi khóa học đã khóa."}
            </p>
          </div>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentPeerReviewEdit;
