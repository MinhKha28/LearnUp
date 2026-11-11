import { Input, Radio, Select, message } from "antd";
import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { FieldError, NumberField } from "@/components/instructor/form.field";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage, WarningPanel } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, createQuizAPI, toApiCourseId } from "@/services/assessment.service";
import type { IAssessmentError } from "@/types/assessment.types";
import {
  ATTEMPTS_RULE,
  LOCK_HOURS_RULE,
  QUIZ_PASSING_SCORE_RULE,
  TIME_LIMIT_RULE,
  validateNumber,
} from "@/utils/validation";
import "./course.create.scss";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

// BR-285 / BR-69 / BR-284: Course states in which an Instructor may add a Quiz.
const AUTHORABLE_STATUSES = ["Draft", "Rejected", "Published"];
const COURSE_LEVEL = "course";

const ERROR_TEXT: Record<string, string> = {
  MODULE_NOT_IN_COURSE: "Chương đã chọn không còn thuộc khóa học này. Hãy tải lại trang và chọn lại.",
  REQUIRED_QUIZ_ON_LOCKED_COURSE:
    "Khóa học đã khóa vì có học viên tham gia. Chỉ được thêm bài trắc nghiệm không bắt buộc.",
  COURSE_NOT_EDITABLE: "Hiện không thể chỉnh sửa khóa học nên không thể thêm bài trắc nghiệm.",
  COURSE_NOT_FOUND: "Không tìm thấy khóa học hoặc khóa học không thuộc quyền phụ trách của bạn.",
  FORBIDDEN: "Chỉ giảng viên được tạo bài trắc nghiệm.",
  COURSE_SERVICE_UNAVAILABLE: "Dịch vụ khóa học không khả dụng. Vui lòng thử lại sau.",
};

/** Same normalisation as the API: trim and collapse inner whitespace. */
const normalizeTitle = (value: string) => value.trim().replace(/\s+/g, " ");

const errorCodeOf = (res: unknown): string | undefined => {
  const { error } = res as IAssessmentError;
  return typeof error === "object" ? error?.code : undefined;
};

const CourseBuilderQuizCreate = () => {
  const navigate = useNavigate();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;
  const status = course.status;
  // Submitted, Archived and Disabled Courses cannot be authored (same rule as the API).
  const formLocked = !AUTHORABLE_STATUSES.includes(status);
  // BR-318: a Locked Course only accepts an optional Quiz.
  const onlyOptional = !formLocked && course.locked;

  const attachOptions = [
    ...structure.modules.map((module, index) => ({
      value: module.id,
      label: `Chương ${index + 1}: ${module.title}`,
    })),
    { value: COURSE_LEVEL, label: `${course.name} (cấp khóa học)` },
  ];

  const [title, setTitle] = useState("");
  const [attachTo, setAttachTo] = useState<string>(attachOptions[0].value);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [passingScore, setPassingScore] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [lockHours, setLockHours] = useState<number | null>(null);
  // No default: the Instructor must choose (BR-157).
  const [isRequired, setIsRequired] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const base = `/instructor/courses/${course.id}/builder`;
  const listPath = `${base}/quizzes`;
  const normalizedTitle = normalizeTitle(title);

  const errors = {
    title: !normalizedTitle
      ? "Nhập tên bài trắc nghiệm."
      : normalizedTitle.length > 200
        ? "Tối đa 200 ký tự."
        : null,
    timeLimit: validateNumber(timeLimit, TIME_LIMIT_RULE),
    passingScore: validateNumber(passingScore, QUIZ_PASSING_SCORE_RULE),
    attempts: validateNumber(attempts, ATTEMPTS_RULE),
    lockHours: validateNumber(lockHours, LOCK_HOURS_RULE),
    isRequired:
      isRequired === null
        ? "Chọn bắt buộc hoặc không bắt buộc."
        : onlyOptional && isRequired
          ? "Khóa học đã khóa chỉ được thêm bài trắc nghiệm không bắt buộc."
          : null,
  };

  const handleCreate = async () => {
    if (saving || formLocked) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      message.warning("Vui lòng kiểm tra các trường được đánh dấu.");
      requestAnimationFrame(() =>
        document
          .querySelector(".builder-field-error, .ant-input-status-error, .ant-input-number-status-error")
          ?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      return;
    }
    setSaving(true);
    try {
      const res = await createQuizAPI({
        courseId: toApiCourseId(course.id),
        ...(attachTo !== COURSE_LEVEL ? { moduleId: attachTo } : {}),
        title: normalizedTitle,
        timeLimitMinutes: timeLimit!,
        passingScore: passingScore!,
        isRequired: isRequired!,
        ...(attempts ? { maxConsecutiveAttempts: attempts } : {}),
        ...(lockHours ? { lockoutHours: lockHours } : {}),
      });
      // The axios interceptor resolves HTTP errors too, so only res.data tells success apart.
      if (!res.data) {
        const code = errorCodeOf(res);
        message.error((code && ERROR_TEXT[code]) || assessmentErrorText(res, "Không thể tạo bài trắc nghiệm."));
        return;
      }
      message.success("Đã tạo bài trắc nghiệm.");
      navigate(listPath);
    } catch {
      message.error("Không thể kết nối dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Xây dựng khóa học / Tạo bài trắc nghiệm</span>
      <div className="builder-hero">
        <h1>Tạo bài trắc nghiệm</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          {formLocked && (
            <WarningPanel title="Không thể chỉnh sửa khóa học này">
              {structure.lockReason ?? `Khóa học đang ở trạng thái ${course.status} nên không thể thêm bài trắc nghiệm.`}
            </WarningPanel>
          )}
          {onlyOptional && (
            <WarningPanel title="Khóa học đã khóa">
              Đã có học viên tham gia khóa học nên chỉ được thêm bài trắc nghiệm không bắt buộc. Bài trắc nghiệm được đặt ở cuối vị trí gắn.
            </WarningPanel>
          )}

          <label className="instructor-form-label">Tên bài trắc nghiệm</label>
          <Input
            value={title}
            maxLength={200}
            disabled={formLocked}
            status={submitted && errors.title ? "error" : undefined}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Bài trắc nghiệm chương 2"
          />
          <FieldError message={submitted ? errors.title : null} />

          <label className="instructor-form-label instructor-form-label-spaced">Áp dụng cho</label>
          <Select
            style={{ width: "100%" }}
            value={attachTo}
            disabled={formLocked}
            onChange={setAttachTo}
            options={attachOptions}
          />

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Thời gian làm bài (phút, 1–1440)</label>
              <NumberField
                rule={TIME_LIMIT_RULE}
                showError={submitted}
                disabled={formLocked}
                value={timeLimit}
                onChange={setTimeLimit}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Điểm đạt (lớn hơn 0, tối đa 100)</label>
              <NumberField
                rule={QUIZ_PASSING_SCORE_RULE}
                showError={submitted}
                disabled={formLocked}
                value={passingScore}
                onChange={setPassingScore}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Số lượt làm liên tiếp (n)</label>
              <NumberField
                rule={ATTEMPTS_RULE}
                showError={submitted}
                disabled={formLocked}
                placeholder="Mặc định hệ thống"
                value={attempts}
                onChange={setAttempts}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Thời gian khóa tạm (m giờ)</label>
              <NumberField
                rule={LOCK_HOURS_RULE}
                showError={submitted}
                disabled={formLocked}
                placeholder="Mặc định hệ thống"
                value={lockHours}
                onChange={setLockHours}
              />
            </div>
          </div>

          <label className="instructor-form-label instructor-form-label-spaced">Điều kiện cấp chứng chỉ</label>
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            disabled={formLocked}
            value={isRequired === null ? undefined : isRequired}
            onChange={(event) => setIsRequired(event.target.value as boolean)}
            options={[
              { label: "Bắt buộc", value: true, disabled: onlyOptional },
              { label: "Không bắt buộc", value: false },
            ]}
          />
          <FieldError message={submitted ? errors.isRequired : null} />

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(listPath)}>Hủy</InstructorButton>
            <InstructorButton type="primary" loading={saving} disabled={formLocked} onClick={handleCreate}>
              Tạo bài trắc nghiệm
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Điều kiện cấp chứng chỉ">
            Bài trắc nghiệm có thể không bắt buộc để luyện tập; bài bắt buộc được tính vào điều kiện cấp chứng chỉ.
          </InfoPanel>
          <InfoPanel title="Lượt làm và thời gian khóa">
            Để trống n và m nếu dùng giá trị mặc định hệ thống. Giá trị sẽ được lưu vào bài trắc nghiệm khi tạo.
          </InfoPanel>
          <InfoPanel title="Câu hỏi">
            Bài trắc nghiệm mới chưa có câu hỏi. Chỉ có thể gửi khóa học phê duyệt khi mỗi bài trắc nghiệm có ít nhất một câu hỏi.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizCreate;
