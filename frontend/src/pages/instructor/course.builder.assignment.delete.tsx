import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderAssignment,
  findCourseStructure,
  findInstructorCourse,
  removeBuilderAssignment,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";
import "./course.builder.confirm.scss";

const CourseBuilderAssignmentDelete = () => {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const assignment = structure ? findBuilderAssignment(structure, assignmentId) : undefined;

  if (!course || !structure || !assignment) return null;

  const base = `/instructor/courses/${course.id}/builder`;
  const canDelete = !course.locked && !assignment.locked;

  const handleDelete = () => {
    removeBuilderAssignment(structure, assignment.id);
    message.success("Assignment deleted.");
    navigate(`${base}/assignments`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Delete Assignment</span>
      <div className="builder-hero">
        <h1>Delete Assignment</h1>
      </div>
      <div className="builder-confirm-card">
        <div className="builder-confirm-warning">
          <strong>Delete Assignment?</strong>
          <p>This removes the Assignment. Submission data prevents deletion after lock.</p>
        </div>
        <p className="builder-confirm-note">
          Available only while the relevant Course and content rules allow deletion.
        </p>
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(-1)}>Cancel</InstructorButton>
          <InstructorButton type="primary" disabled={!canDelete} onClick={handleDelete}>
            Delete Assignment
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentDelete;
