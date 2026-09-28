import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  findCourseStructure,
  findInstructorCourse,
  removeBuilderModule,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";
import "./course.builder.confirm.scss";

const CourseBuilderModuleDelete = () => {
  const { courseId, moduleId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);

  if (!course || !structure) return null;

  const base = `/instructor/courses/${course.id}/builder`;
  const canDelete = !course.locked;

  const handleDelete = () => {
    if (!moduleId) return;
    removeBuilderModule(structure, moduleId);
    message.success("Module deleted.");
    navigate(base);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Delete Module</span>
      <div className="builder-hero">
        <h1>Delete Module</h1>
      </div>
      <div className="builder-confirm-card">
        <div className="builder-confirm-warning">
          <strong>Delete Module?</strong>
          <p>This deletes the Module and every Lesson, resource and Module Quiz inside it.</p>
        </div>
        <p className="builder-confirm-note">
          Available only while the relevant Course and content rules allow deletion.
        </p>
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(-1)}>Cancel</InstructorButton>
          <InstructorButton type="primary" disabled={!canDelete} onClick={handleDelete}>
            Delete Module
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderModuleDelete;
