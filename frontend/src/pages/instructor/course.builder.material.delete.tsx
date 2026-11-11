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
      <span className="builder-crumb">Xây dựng khóa học / Xóa học liệu</span>
      <div className="builder-hero">
        <h1>Xóa học liệu</h1>
      </div>
      <div className="builder-confirm-card">
        <div className="builder-confirm-warning">
          <strong>Xóa học liệu này?</strong>
          <p>Thao tác sẽ xóa tệp khỏi bài học và giải phóng dung lượng lưu trữ.</p>
        </div>
        <p className="builder-confirm-note">
          Chỉ có thể xóa khi quy tắc của khóa học và nội dung liên quan cho phép.
        </p>
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(-1)}>Hủy</InstructorButton>
          <InstructorButton type="primary" disabled={!canDelete} onClick={handleDelete}>
            Xóa học liệu
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderMaterialDelete;
