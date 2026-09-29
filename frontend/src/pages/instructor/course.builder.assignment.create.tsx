import { Input, InputNumber, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addBuilderAssignment,
  findCourseStructure,
  findInstructorCourse,
  slugify,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.create.scss";
import "./course.builder.scss";

const CourseBuilderAssignmentCreate = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [passingScore, setPassingScore] = useState<number | null>(null);
  const [estimatedEffort, setEstimatedEffort] = useState<number | null>(null);
  const [consecutiveSubmissions, setConsecutiveSubmissions] = useState<number | null>(null);
  const [lockHours, setLockHours] = useState<number | null>(null);

  if (!course || !structure) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  const handleContinue = () => {
    if (!title.trim()) {
      message.warning("Enter an Assignment title.");
      return;
    }
    const id = slugify(title);
    addBuilderAssignment(structure, {
      id,
      title: title.trim(),
      instructions: instructions.trim(),
      passingScore: passingScore ?? undefined,
      estimatedEffortMinutes: estimatedEffort ?? undefined,
      consecutiveSubmissions: consecutiveSubmissions ?? undefined,
      lockHours: lockHours ?? undefined,
      rubric: [],
      peerReviewEnabled: false,
      locked: false,
    });
    message.success("Assignment created. Configure the Rubric next.");
    navigate(`${base}/assignments/${id}/rubric`);
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
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Safety Assignment" />

          <label className="instructor-form-label instructor-form-label-spaced">Instructions</label>
          <Input.TextArea
            className="builder-textarea"
            placeholder="Write the Assignment instructions..."
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Passing score</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={0}
                max={100}
                value={passingScore ?? undefined}
                onChange={(value) => setPassingScore(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">
                Estimated effort (minutes)
              </label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={0}
                value={estimatedEffort ?? undefined}
                onChange={(value) => setEstimatedEffort(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">
                Consecutive submissions (n)
              </label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={1}
                value={consecutiveSubmissions ?? undefined}
                onChange={(value) => setConsecutiveSubmissions(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">
                Temporary lock (m hours)
              </label>
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
            <InstructorButton onClick={() => navigate(base)}>Cancel</InstructorButton>
            <InstructorButton type="primary" onClick={handleContinue}>
              Continue
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Required Rubric">A Rubric is mandatory even without Peer Review.</InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentCreate;
