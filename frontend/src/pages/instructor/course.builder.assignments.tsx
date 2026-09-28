import { useNavigate, useParams } from "react-router-dom";
import { findCourseStructure, findInstructorCourse } from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderAssignments = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);

  if (!course || !structure) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Assignments</span>
      <div className="builder-hero">
        <h1>Assignments</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <div className="builder-table">
            <div className="builder-table-row builder-table-head">
              <span>Assignment</span>
              <span>Peer Review</span>
              <span>Attempts</span>
              <span>Lock</span>
            </div>
            {structure.assignments.map((assignment) => (
              <div
                className="builder-table-row builder-table-row-clickable"
                key={assignment.id}
                onClick={() => navigate(`${base}/assignments/${assignment.id}`)}
              >
                <strong>{assignment.title}</strong>
                <span>{assignment.peerReviewEnabled ? "On" : "Off"}</span>
                <span>{assignment.consecutiveSubmissions ?? "—"} per sequence</span>
                <span>{assignment.locked ? "Locked" : "Unlocked"}</span>
              </div>
            ))}
            {structure.assignments.length === 0 && (
              <div className="builder-table-row">
                <span>No Assignments yet.</span>
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          <div className="builder-actions">
            <InstructorButton
              type="primary"
              disabled={course.locked}
              onClick={() => navigate(`${base}/assignments/new`)}
            >
              + Add Assignment
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Course-level Assessment">
            Every Assignment is Required for Certificate completion.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignments;
