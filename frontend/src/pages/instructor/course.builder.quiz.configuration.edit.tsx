import { InputNumber, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderQuiz,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.create.scss";
import "./course.builder.scss";

const CourseBuilderQuizConfigurationEdit = () => {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const quiz = structure ? findBuilderQuiz(structure, quizId) : undefined;

  const [timeLimit, setTimeLimit] = useState<number | null>(quiz?.timeLimitMinutes ?? null);
  const [attempts, setAttempts] = useState<number | null>(quiz?.attempts ?? null);
  const [lockHours, setLockHours] = useState<number | null>(quiz?.lockHours ?? null);
  const [passingScore, setPassingScore] = useState<number | null>(quiz?.passingScore ?? null);
  const [requirement, setRequirement] = useState<"Required" | "Optional">(
    quiz?.required ? "Required" : "Optional",
  );

  if (!course || !structure || !quiz) return null;

  const base = `/instructor/courses/${course.id}/builder`;
  const attemptFieldsLocked = quiz.locked;
  const requirementFieldsLocked = course.locked;

  const handleSave = () => {
    if (!attemptFieldsLocked) {
      quiz.timeLimitMinutes = timeLimit ?? undefined;
      quiz.attempts = attempts ?? undefined;
      quiz.lockHours = lockHours ?? undefined;
    }
    if (!requirementFieldsLocked) {
      quiz.passingScore = passingScore ?? undefined;
      quiz.required = requirement === "Required";
    }
    message.success("Quiz settings saved.");
    navigate(`${base}/quizzes/${quiz.id}`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Edit Quiz Configuration</span>
      <div className="builder-hero">
        <h1>Edit Quiz Configuration</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label">Time limit</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured minutes]"
                min={1}
                disabled={attemptFieldsLocked}
                value={timeLimit ?? undefined}
                onChange={(value) => setTimeLimit(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Consecutive attempts (n)</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={1}
                disabled={attemptFieldsLocked}
                value={attempts ?? undefined}
                onChange={(value) => setAttempts(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Temporary lock (m hours)</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={0}
                disabled={attemptFieldsLocked}
                value={lockHours ?? undefined}
                onChange={(value) => setLockHours(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Minimum passing score</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={0}
                max={100}
                disabled={requirementFieldsLocked}
                value={passingScore ?? undefined}
                onChange={(value) => setPassingScore(typeof value === "number" ? value : null)}
              />
            </div>
          </div>

          <label className="instructor-form-label instructor-form-label-spaced">Requirement</label>
          <div className="instructor-pill-toggle">
            <button
              type="button"
              disabled={requirementFieldsLocked}
              className={requirement === "Required" ? "instructor-pill-active" : ""}
              onClick={() => setRequirement("Required")}
            >
              Required
            </button>
            <button
              type="button"
              disabled={requirementFieldsLocked}
              className={requirement === "Optional" ? "instructor-pill-active" : ""}
              onClick={() => setRequirement("Optional")}
            >
              Optional
            </button>
          </div>

          <div className="builder-banner" style={{ marginTop: 20 }}>
            <strong>Independent restrictions</strong>
            <p>Time/n/m lock after first Quiz attempt; pass score/Required lock with Course.</p>
          </div>

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/quizzes/${quiz.id}`)}>Cancel</InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Save settings
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Data protection">
            Question editing is separately locked by first Quiz attempt.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizConfigurationEdit;
