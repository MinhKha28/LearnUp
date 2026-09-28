import { Input, InputNumber, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderAssignment,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.create.scss";
import "./course.builder.scss";

const CourseBuilderAssignmentEdit = () => {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const assignment = structure ? findBuilderAssignment(structure, assignmentId) : undefined;

  const [instructions, setInstructions] = useState(assignment?.instructions ?? "");
  const [estimatedEffort, setEstimatedEffort] = useState<number | null>(
    assignment?.estimatedEffortMinutes ?? null,
  );
  const [consecutiveSubmissions, setConsecutiveSubmissions] = useState<number | null>(
    assignment?.consecutiveSubmissions ?? null,
  );
  const [lockHours, setLockHours] = useState<number | null>(assignment?.lockHours ?? null);

  if (!course || !structure || !assignment) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  const handleSave = () => {
    assignment.instructions = instructions.trim();
    assignment.estimatedEffortMinutes = estimatedEffort ?? undefined;
    assignment.consecutiveSubmissions = consecutiveSubmissions ?? undefined;
    assignment.lockHours = lockHours ?? undefined;
    message.success("Assignment saved.");
    navigate(`${base}/assignments/${assignment.id}`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Edit Assignment</span>
      <div className="builder-hero">
        <h1>Edit Assignment</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <label className="instructor-form-label">Instructions and Rubric</label>
          <Input.TextArea
            className="builder-textarea"
            placeholder="[Editable instructions before first submission]"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
          <div className="builder-actions" style={{ marginTop: 0 }}>
            <InstructorButton onClick={() => navigate(`${base}/assignments/${assignment.id}/rubric`)}>
              Edit Rubric
            </InstructorButton>
          </div>

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label">Estimated effort (minutes)</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={0}
                value={estimatedEffort ?? undefined}
                onChange={(value) => setEstimatedEffort(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Consecutive submissions (n)</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={1}
                value={consecutiveSubmissions ?? undefined}
                onChange={(value) => setConsecutiveSubmissions(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Temporary lock (m hours)</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={0}
                value={lockHours ?? undefined}
                onChange={(value) => setLockHours(typeof value === "number" ? value : null)}
              />
            </div>
          </div>

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/assignments/${assignment.id}`)}>
              Cancel
            </InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Save changes
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Edit conditions">
            Instructions, Rubric and n/m lock after first submission; effort stays editable.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentEdit;
