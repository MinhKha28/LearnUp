import { InputNumber, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderAssignment,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderAssignmentDetail = () => {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const assignment = structure ? findBuilderAssignment(structure, assignmentId) : undefined;
  const [estimatedEffort, setEstimatedEffort] = useState<number | null>(
    assignment?.estimatedEffortMinutes ?? null,
  );

  if (!course || !structure || !assignment) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  if (assignment.locked) {
    const handleSaveEffort = () => {
      assignment.estimatedEffortMinutes = estimatedEffort ?? undefined;
      message.success("Estimated effort saved.");
    };

    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Assignment Editing Restricted</span>
        <div className="builder-hero">
          <h1>Assignment Editing Restricted</h1>
        </div>
        <div className="builder-banner">
          <strong>Submission data exists</strong>
          <p>Instructions, Rubric, n attempts and m-hour lock cannot be edited.</p>
        </div>
        <div className="builder-grid">
          <div className="builder-update-card">
            <h2>Allowed update</h2>
            <label className="instructor-form-label instructor-form-label-spaced">
              Estimated effort (minutes)
            </label>
            <label className="instructor-form-label">Estimated effort</label>
            <InputNumber
              style={{ width: "100%" }}
              placeholder="[Configured minutes]"
              min={0}
              value={estimatedEffort ?? undefined}
              onChange={(value) => setEstimatedEffort(typeof value === "number" ? value : null)}
            />
            <p className="builder-lesson-intro" style={{ marginTop: 16 }}>
              Estimated effort affects display and Course duration only.
            </p>
            <p className="builder-lesson-intro">Structural and scoring changes require a new version.</p>
            <div className="builder-actions">
              <InstructorButton type="primary" onClick={handleSaveEffort}>
                Save effort
              </InstructorButton>
            </div>
          </div>
          <div className="builder-side">
            <div className="builder-banner" style={{ marginBottom: 0 }}>
              <strong>Different lock reasons</strong>
              <p>Submission locks scoring rules; Course Locked protects structure.</p>
            </div>
          </div>
        </div>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Assignment Detail</span>
      <div className="builder-hero">
        <h1>Assignment Detail</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Instructions</h2>
          <p className="builder-lesson-intro">
            {assignment.instructions || "No Instructions written yet."}
          </p>
          <hr className="builder-divider" />
          <h2>Rubric and scoring</h2>
          <p className="builder-lesson-intro">
            Rubric: {assignment.rubric.length > 0 ? "[Instructor-defined criteria]" : "[Not configured]"}
          </p>
          <p className="builder-lesson-intro">Pass score: {assignment.passingScore ?? "[Configured]"}</p>
          <p className="builder-lesson-intro">
            Estimated effort: {assignment.estimatedEffortMinutes ?? "[Configured minutes]"}
          </p>
          <hr className="builder-divider" />
          <h2>Submission rules</h2>
          <p className="builder-lesson-intro">
            No separate Assignment deadline. {assignment.consecutiveSubmissions ?? "n"} consecutive
            submissions, then {assignment.lockHours ?? "m"}-hour temporary lock until retry. Latest score is
            recorded.
          </p>
          <div className="builder-actions builder-actions-split">
            <button
              type="button"
              className="builder-table-link builder-table-link-danger"
              onClick={() => navigate(`/instructor/courses/${course.id}/builder/assignments/${assignment.id}/delete`)}
            >
              Delete Assignment
            </button>
            <InstructorButton onClick={() => navigate(`${base}/assignments/${assignment.id}/edit`)}>
              Edit Assignment
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Peer Review">
            {assignment.peerReviewEnabled
              ? "Enabled • Reviewer count and cycle configured."
              : "Disabled for this Assignment."}
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentDetail;
