import { Input, Radio, Select, message } from "antd";
import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { FieldError, NumberField } from "@/components/instructor/form.field";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage, WarningPanel } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, createQuizAPI, toApiCourseId } from "@/services/assessment.service";
import type { IAssessmentError } from "@/types/assessment.types";
import { ATTEMPTS_RULE, LOCK_HOURS_RULE, type INumberRule, validateNumber } from "@/utils/validation";
import "./course.create.scss";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

// Quiz limits, same as the API (UC18.2): time limit 1–1440 minutes, passing score above 0 up to 100 with 2 decimals.
const TIME_LIMIT_RULE: INumberRule = { required: true, integer: true, min: 1, max: 1440 };
// With at most 2 decimals, "greater than 0" is the same as "at least 0.01".
const QUIZ_PASSING_SCORE_RULE: INumberRule = { required: true, min: 0.01, max: 100, decimals: 2 };

// BR-285 / BR-69 / BR-284: Course states in which an Instructor may add a Quiz.
const AUTHORABLE_STATUSES = ["Draft", "Rejected", "Published"];
const COURSE_LEVEL = "course";

const ERROR_TEXT: Record<string, string> = {
  MODULE_NOT_IN_COURSE: "The selected Module no longer belongs to this Course. Reload the page and choose again.",
  REQUIRED_QUIZ_ON_LOCKED_COURSE:
    "The Course is Locked because a Learner has enrolled, so only an optional Quiz can be added.",
  COURSE_NOT_EDITABLE: "This Course cannot be edited right now, so no Quiz can be added.",
  COURSE_NOT_FOUND: "This Course was not found or is not one of your Courses.",
  FORBIDDEN: "Only an Instructor can create Quizzes.",
  COURSE_SERVICE_UNAVAILABLE: "The Course service is unavailable. Please try again later.",
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
      label: `Module ${index + 1}: ${module.title}`,
    })),
    { value: COURSE_LEVEL, label: `${course.name} (Course level)` },
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
      ? "Enter a Quiz title."
      : normalizedTitle.length > 200
        ? "Use at most 200 characters."
        : null,
    timeLimit: validateNumber(timeLimit, TIME_LIMIT_RULE),
    passingScore: validateNumber(passingScore, QUIZ_PASSING_SCORE_RULE),
    attempts: validateNumber(attempts, ATTEMPTS_RULE),
    lockHours: validateNumber(lockHours, LOCK_HOURS_RULE),
    isRequired:
      isRequired === null
        ? "Choose Required or Optional."
        : onlyOptional && isRequired
          ? "Only an optional Quiz can be added to a Locked Course."
          : null,
  };

  const handleCreate = async () => {
    if (saving || formLocked) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      message.warning("Please fix the highlighted fields.");
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
        message.error((code && ERROR_TEXT[code]) || assessmentErrorText(res, "Unable to create the Quiz."));
        return;
      }
      message.success("Quiz created.");
      navigate(listPath);
    } catch {
      message.error("Unable to reach the Assessment service. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Create Quiz</span>
      <div className="builder-hero">
        <h1>Create Quiz</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          {formLocked && (
            <WarningPanel title="This Course cannot be edited">
              {structure.lockReason ?? `The Course is ${course.status}, so no Quiz can be added.`}
            </WarningPanel>
          )}
          {onlyOptional && (
            <WarningPanel title="Course Locked">
              A Learner has enrolled in this Course, so only an optional Quiz can be added. It is placed at the end of
              where it is attached.
            </WarningPanel>
          )}

          <label className="instructor-form-label">Quiz title</label>
          <Input
            value={title}
            maxLength={200}
            disabled={formLocked}
            status={submitted && errors.title ? "error" : undefined}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Module 2 Quiz"
          />
          <FieldError message={submitted ? errors.title : null} />

          <label className="instructor-form-label instructor-form-label-spaced">Attach to</label>
          <Select
            style={{ width: "100%" }}
            value={attachTo}
            disabled={formLocked}
            onChange={setAttachTo}
            options={attachOptions}
          />

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Time limit (minutes, 1-1440)</label>
              <NumberField
                rule={TIME_LIMIT_RULE}
                showError={submitted}
                disabled={formLocked}
                value={timeLimit}
                onChange={setTimeLimit}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Passing score (above 0, max 100)</label>
              <NumberField
                rule={QUIZ_PASSING_SCORE_RULE}
                showError={submitted}
                disabled={formLocked}
                value={passingScore}
                onChange={setPassingScore}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Consecutive attempts (n)</label>
              <NumberField
                rule={ATTEMPTS_RULE}
                showError={submitted}
                disabled={formLocked}
                placeholder="Platform default"
                value={attempts}
                onChange={setAttempts}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Temporary lock (m hours)</label>
              <NumberField
                rule={LOCK_HOURS_RULE}
                showError={submitted}
                disabled={formLocked}
                placeholder="Platform default"
                value={lockHours}
                onChange={setLockHours}
              />
            </div>
          </div>

          <label className="instructor-form-label instructor-form-label-spaced">Certificate requirement</label>
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            disabled={formLocked}
            value={isRequired === null ? undefined : isRequired}
            onChange={(event) => setIsRequired(event.target.value as boolean)}
            options={[
              { label: "Required", value: true, disabled: onlyOptional },
              { label: "Optional", value: false },
            ]}
          />
          <FieldError message={submitted ? errors.isRequired : null} />

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(listPath)}>Cancel</InstructorButton>
            <InstructorButton type="primary" loading={saving} disabled={formLocked} onClick={handleCreate}>
              Create Quiz
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Certificate requirement">
            A Quiz can be Optional for practice. Required Quizzes count toward the Certificate.
          </InfoPanel>
          <InfoPanel title="Attempts and lock">
            Leave n and m empty to use the platform defaults. The values are copied into the Quiz when it is created.
          </InfoPanel>
          <InfoPanel title="Questions">
            A new Quiz has no questions yet. The Course cannot be submitted for review until every Quiz has at least one
            question.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizCreate;
