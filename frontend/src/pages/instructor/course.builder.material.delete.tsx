import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  findCourseStructure,
  findInstructorCourse,
  removeBuilderResource,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";
import "./course.builder.confirm.scss";

const CourseBuilderMaterialDelete = () => {
  const { courseId, lessonId, materialId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);

  if (!course || !structure) return null;

  const materialsBase = `/instructor/courses/${course.id}/builder/lessons/${lessonId}/materials`;
  const canDelete = !course.locked;

  const handleDelete = () => {
    if (!materialId) return;
    removeBuilderResource(structure, materialId);
    message.success("Learning material deleted.");
    navigate(materialsBase);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Delete Material</span>
      <div className="builder-hero">
        <h1>Delete Learning Material</h1>
      </div>
      <div className="builder-confirm-card">
        <div className="builder-confirm-warning">
          <strong>Delete Learning Material?</strong>
          <p>This removes the file from the Lesson and frees its storage usage.</p>
        </div>
        <p className="builder-confirm-note">
          Available only while the relevant Course and content rules allow deletion.
        </p>
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(-1)}>Cancel</InstructorButton>
          <InstructorButton type="primary" disabled={!canDelete} onClick={handleDelete}>
            Delete Learning Material
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderMaterialDelete;
