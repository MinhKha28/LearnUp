import { Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FieldError, NumberField } from "@/components/instructor/form.field";
import { findInstructorCourse } from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import RubricEditor from "@/components/instructor/rubric.editor";
import { assessmentErrorText, createAssignmentAPI, toApiCourseId } from "@/services/assessment.service";
import type { IRubricRow } from "@/types/assessment.types";
import { newRubricRow } from "@/utils/helper";
import { RUBRIC_POINTS_RULE, type INumberRule, validateNumber } from "@/utils/validation";
import "./course.create.scss";
import "./course.builder.scss";

// Same limits as the API, so the form says "no" before the server does.
const SCORE_RULE: INumberRule = { required: true, min: 0, max: 100, decimals: 2 };
const EFFORT_RULE: INumberRule = { required: true, integer: true, min: 1 };
const ATTEMPTS_RULE: INumberRule = { integer: true, min: 1 };
const LOCK_RULE: INumberRule = { integer: true, min: 1 };

const CourseBuilderAssignmentCreate = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [passingScore, setPassingScore] = useState<number | null>(null);
  const [estimatedEffort, setEstimatedEffort] = useState<number | null>(null);
  const [consecutiveSubmissions, setConsecutiveSubmissions] = useState<number | null>(null);
  const [lockHours, setLockHours] = useState<number | null>(null);
  const [rubric, setRubric] = useState<IRubricRow[]>([newRubricRow()]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!course) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  const errors = {
    title: title.trim() ? null : "Enter an Assignment title.",
    instructions: instructions.trim() ? null : "Write the Assignment instructions.",
    passingScore: validateNumber(passingScore, SCORE_RULE),
    estimatedEffort: validateNumber(estimatedEffort, EFFORT_RULE),
    consecutiveSubmissions: validateNumber(consecutiveSubmissions, ATTEMPTS_RULE),
    lockHours: validateNumber(lockHours, LOCK_RULE),
    // BR-164: a Rubric is mandatory; every criterion needs a description and a positive whole maximum score.
    rubric: rubric.some((row) => !row.description.trim() || validateNumber(row.maxPoints, RUBRIC_POINTS_RULE))
      ? "Fix the Rubric criteria."
      : null,
  };

  const handleCreate = async () => {
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
      const res = await createAssignmentAPI({
        courseId: toApiCourseId(course.id),
        title: title.trim(),
        prompt: instructions.trim(),
        passingScore: passingScore!,
        expectedDurationMinutes: estimatedEffort!,
        ...(consecutiveSubmissions ? { maxConsecutiveAttempts: consecutiveSubmissions } : {}),
        ...(lockHours ? { lockoutHours: lockHours } : {}),
        rubric: rubric.map((row) => ({
          name: row.description.trim().slice(0, 200),
          description: row.description.trim(),
          maxPoints: row.maxPoints!,
        })),
      });
      const created = res.data;
      if (!created) {
        message.error(assessmentErrorText(res, "Unable to create the Assignment."));
        return;
      }
      message.success("Assignment created.");
      navigate(`${base}/assignments/${created.id}`);
    } catch {
      message.error("Unable to reach the Assessment service. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Create Assignment</span>
      <div className="builder-hero">
        <h1>Create Assignment</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <label className="instructor-form-label">Assignment title</label>
          <Input
            value={title}
            maxLength={200}
            status={submitted && errors.title ? "error" : undefined}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Safety Assignment"
          />
          <FieldError message={submitted ? errors.title : null} />

          <label className="instructor-form-label instructor-form-label-spaced">Instructions</label>
          <Input.TextArea
            className="builder-textarea"
            placeholder="Write the Assignment instructions..."
            maxLength={8000}
            status={submitted && errors.instructions ? "error" : undefined}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
          <FieldError message={submitted ? errors.instructions : null} />

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Passing score (0-100)</label>
              <NumberField rule={SCORE_RULE} showError={submitted} value={passingScore} onChange={setPassingScore} />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">
                Estimated effort (minutes)
              </label>
              <NumberField
                rule={EFFORT_RULE}
                showError={submitted}
                value={estimatedEffort}
                onChange={setEstimatedEffort}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">
                Consecutive submissions (n)
              </label>
              <NumberField
                rule={ATTEMPTS_RULE}
                showError={submitted}
                placeholder="Platform default"
                value={consecutiveSubmissions}
                onChange={setConsecutiveSubmissions}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">
                Temporary lock (m hours)
              </label>
              <NumberField
                rule={LOCK_RULE}
                showError={submitted}
                placeholder="Platform default"
                value={lockHours}
                onChange={setLockHours}
              />
            </div>
          </div>

          <h2 className="instructor-form-label-spaced">Rubric</h2>
          <RubricEditor rows={rubric} onChange={setRubric} showErrors={submitted} />

          <div className="builder-actions builder-actions-split">
            <InstructorButton onClick={() => navigate(base)}>Cancel</InstructorButton>
            <InstructorButton type="primary" loading={saving} onClick={handleCreate}>
              Create Assignment
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Required Rubric">A Rubric is mandatory even without Peer Review.</InfoPanel>
          <InfoPanel title="No deadline, always graded">
            Assignments have no submission deadline and always count toward the Certificate. Submissions are
            controlled by n attempts and an m-hour lock.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentCreate;
