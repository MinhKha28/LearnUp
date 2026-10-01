import { Input, message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useOutletContext } from "react-router-dom";
import { FieldError, NumberField } from "@/components/instructor/form.field";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import RubricEditor from "@/components/instructor/rubric.editor";
import { assessmentErrorText, fetchAssignmentAPI, updateAssignmentAPI } from "@/services/assessment.service";
import type { IAssignment, IRubricRow, IUpdateAssignment } from "@/types/assessment.types";
import { newRubricRow } from "@/utils/helper";
import {
  ATTEMPTS_RULE,
  EFFORT_RULE,
  LOCK_HOURS_RULE,
  PASSING_SCORE_RULE,
  RUBRIC_POINTS_RULE,
  validateNumber,
} from "@/utils/validation";
import "./course.create.scss";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

// On edit, n and m always have a value, so they are required here (on create they fall back to the platform default).
const REQUIRED_ATTEMPTS_RULE = { ...ATTEMPTS_RULE, required: true };
const REQUIRED_LOCK_HOURS_RULE = { ...LOCK_HOURS_RULE, required: true };

const toRubricRows = (assignment: IAssignment): IRubricRow[] =>
  assignment.rubric.map((c) => newRubricRow(c.description, c.maxPoints));

const CourseBuilderAssignmentEdit = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;

  const [assignment, setAssignment] = useState<IAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [passingScore, setPassingScore] = useState<number | null>(null);
  const [estimatedEffort, setEstimatedEffort] = useState<number | null>(null);
  const [consecutiveSubmissions, setConsecutiveSubmissions] = useState<number | null>(null);
  const [lockHours, setLockHours] = useState<number | null>(null);
  const [rubric, setRubric] = useState<IRubricRow[]>([]);

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchAssignmentAPI(assignmentId);
        if (!active) return;
        const loaded = res.data;
        if (!loaded) {
          message.error(assessmentErrorText(res, "Unable to load the Assignment."));
          return;
        }
        setAssignment(loaded);
        setTitle(loaded.title);
        setInstructions(loaded.prompt ?? "");
        setPassingScore(loaded.passingScore);
        setEstimatedEffort(loaded.expectedDurationMinutes);
        setConsecutiveSubmissions(loaded.maxConsecutiveAttempts);
        setLockHours(loaded.lockoutHours);
        setRubric(toRubricRows(loaded));
      } catch {
        if (active) message.error("Unable to reach the Assessment service. Please try again.");
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
        <span className="builder-crumb">Course Builder / Edit Assignment</span>
        <div className="builder-hero">
          <h1>{loading ? "Loading Assignment..." : "Assignment not found"}</h1>
        </div>
        {!loading && <InstructorButton onClick={() => navigate(`${base}/assignments`)}>Back</InstructorButton>}
      </InstructorPage>
    );
  }

  const detailPath = `${base}/assignments/${assignment.id}`;
  // BR-98: prompt, Rubric, n and m freeze once a submission exists. BR-319: passing score freezes when the Course is Locked.
  const submissionLocked = assignment.locked;
  const scoreLocked = assignment.courseLocked;

  const rubricPayload = rubric.map((row) => ({
    name: row.description.trim().slice(0, 200),
    description: row.description.trim(),
    maxPoints: row.maxPoints ?? 0,
  }));
  const rubricChanged =
    JSON.stringify(rubricPayload.map((c) => [c.description, c.maxPoints])) !==
    JSON.stringify(assignment.rubric.map((c) => [c.description.trim(), c.maxPoints]));

  // Frozen fields are not checked: the user cannot change them, so they cannot be wrong.
  const errors = {
    title: title.trim() ? null : "Enter an Assignment title.",
    instructions:
      submissionLocked || instructions.trim() || assignment.promptFile ? null : "Write the Assignment instructions.",
    passingScore: scoreLocked ? null : validateNumber(passingScore, PASSING_SCORE_RULE),
    estimatedEffort: validateNumber(estimatedEffort, EFFORT_RULE),
    consecutiveSubmissions: submissionLocked
      ? null
      : validateNumber(consecutiveSubmissions, REQUIRED_ATTEMPTS_RULE),
    lockHours: submissionLocked ? null : validateNumber(lockHours, REQUIRED_LOCK_HOURS_RULE),
    rubric:
      !submissionLocked &&
      rubric.some((row) => !row.description.trim() || validateNumber(row.maxPoints, RUBRIC_POINTS_RULE))
        ? "Fix the Rubric criteria."
        : null,
  };

  const handleSave = async () => {
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

    // Send only what changed, so untouched frozen fields never trip the server-side rules.
    const payload: IUpdateAssignment = {};
    if (title.trim() !== assignment.title) payload.title = title.trim();
    if (instructions.trim() !== (assignment.prompt ?? "")) payload.prompt = instructions.trim();
    if (passingScore !== assignment.passingScore) payload.passingScore = passingScore!;
    if (estimatedEffort !== assignment.expectedDurationMinutes) payload.expectedDurationMinutes = estimatedEffort!;
    if (consecutiveSubmissions !== assignment.maxConsecutiveAttempts) {
      payload.maxConsecutiveAttempts = consecutiveSubmissions!;
    }
    if (lockHours !== assignment.lockoutHours) payload.lockoutHours = lockHours!;
    if (rubricChanged) payload.rubric = rubricPayload;

    if (Object.keys(payload).length === 0) {
      message.info("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const res = await updateAssignmentAPI(assignment.id, payload);
      if (!res.data) {
        message.error(assessmentErrorText(res, "Unable to save the Assignment."));
        return;
      }
      message.success("Assignment saved.");
      navigate(detailPath, { state: location.state });
    } catch {
      message.error("Unable to reach the Assessment service. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Edit Assignment</span>
      <div className="builder-hero">
        <h1>Edit Assignment</h1>
      </div>
      {submissionLocked && (
        <div className="builder-banner">
          <strong>Submission data exists</strong>
          <p>Instructions, Rubric, n attempts and m-hour lock can no longer be edited.</p>
        </div>
      )}
      <div className="builder-grid">
        <div className="builder-update-card">
          <label className="instructor-form-label">Assignment title</label>
          <Input
            value={title}
            maxLength={200}
            status={submitted && errors.title ? "error" : undefined}
            onChange={(event) => setTitle(event.target.value)}
          />
          <FieldError message={submitted ? errors.title : null} />

          <label className="instructor-form-label instructor-form-label-spaced">Instructions</label>
          <Input.TextArea
            className="builder-textarea"
            maxLength={8000}
            disabled={submissionLocked}
            status={submitted && errors.instructions ? "error" : undefined}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
          <FieldError message={submitted ? errors.instructions : null} />

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Passing score (0-100)</label>
              <NumberField
                rule={PASSING_SCORE_RULE}
                disabled={scoreLocked}
                showError={submitted}
                value={passingScore}
                onChange={setPassingScore}
              />
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
                rule={REQUIRED_ATTEMPTS_RULE}
                disabled={submissionLocked}
                showError={submitted}
                value={consecutiveSubmissions}
                onChange={setConsecutiveSubmissions}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">
                Temporary lock (m hours)
              </label>
              <NumberField
                rule={REQUIRED_LOCK_HOURS_RULE}
                disabled={submissionLocked}
                showError={submitted}
                value={lockHours}
                onChange={setLockHours}
              />
            </div>
          </div>

          <h2 className="instructor-form-label-spaced">Rubric</h2>
          <RubricEditor rows={rubric} onChange={setRubric} disabled={submissionLocked} showErrors={submitted} />

          <div className="builder-actions builder-actions-split">
            <InstructorButton onClick={() => navigate(detailPath, { state: location.state })}>Cancel</InstructorButton>
            <InstructorButton type="primary" loading={saving} onClick={handleSave}>
              Save changes
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Edit conditions">
            Instructions, Rubric and n/m lock after the first submission. The passing score locks once the Course is
            Locked. Estimated effort stays editable.
          </InfoPanel>
          {scoreLocked && (
            <div className="builder-banner" style={{ marginTop: 16, marginBottom: 0 }}>
              <strong>Course Locked</strong>
              <p>The passing score is fixed. Create a new Course version to change it.</p>
            </div>
          )}
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentEdit;
