import { InputNumber, Switch, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderAssignment,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderAssignmentPeerReviewEdit = () => {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const assignment = structure ? findBuilderAssignment(structure, assignmentId) : undefined;

  const [enabled, setEnabled] = useState(assignment?.peerReviewEnabled ?? false);
  const [reviewers, setReviewers] = useState<number | null>(assignment?.reviewersPerSubmission ?? null);
  const [cycleLength, setCycleLength] = useState<number | null>(assignment?.cycleLengthDays ?? null);
  const [reviewDeadline, setReviewDeadline] = useState<number | null>(assignment?.reviewDeadlineDays ?? null);
  const [threshold, setThreshold] = useState<number | null>(assignment?.scoreDiscrepancyThreshold ?? null);

  if (!course || !structure || !assignment) return null;

  const base = `/instructor/courses/${course.id}/builder`;
  const toggleLocked = course.locked;

  const handleSave = () => {
    assignment.peerReviewEnabled = enabled;
    assignment.reviewersPerSubmission = reviewers ?? undefined;
    assignment.cycleLengthDays = cycleLength ?? undefined;
    assignment.reviewDeadlineDays = reviewDeadline ?? undefined;
    assignment.scoreDiscrepancyThreshold = threshold ?? undefined;
    message.success("Peer Review settings saved.");
    navigate(`${base}/assignments/${assignment.id}`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Peer Review Settings</span>
      <div className="builder-hero">
        <h1>Peer Review Settings</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <div className="builder-actions-split" style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Enable Peer Review</h2>
            <Switch checked={enabled} disabled={toggleLocked} onChange={setEnabled} />
          </div>

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label">Reviewers per submission</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={1}
                disabled={!enabled}
                value={reviewers ?? undefined}
                onChange={(value) => setReviewers(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Cycle length (days)</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={1}
                disabled={!enabled}
                value={cycleLength ?? undefined}
                onChange={(value) => setCycleLength(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Review deadline after cycle closes</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured days]"
                min={1}
                disabled={!enabled}
                value={reviewDeadline ?? undefined}
                onChange={(value) => setReviewDeadline(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Score discrepancy threshold</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="[Configured]"
                min={0}
                disabled={!enabled}
                value={threshold ?? undefined}
                onChange={(value) => setThreshold(typeof value === "number" ? value : null)}
              />
            </div>
          </div>

          <InfoPanel title="Cycle timing">
            The review deadline starts when the cycle closes and work is assigned.
          </InfoPanel>

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/assignments/${assignment.id}`)}>
              Cancel
            </InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Save settings
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <div className="builder-banner" style={{ marginBottom: 0 }}>
            <strong>Locked rule</strong>
            <p>Turning Peer Review on or off is blocked after Course Locked.</p>
          </div>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentPeerReviewEdit;
