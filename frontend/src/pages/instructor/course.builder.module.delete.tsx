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
    message.success("Đã xóa chương.");
    navigate(base);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Xây dựng khóa học / Xóa chương</span>
      <div className="builder-hero">
        <h1>Xóa chương</h1>
      </div>
      <div className="builder-confirm-card">
        <div className="builder-confirm-warning">
          <strong>Xóa chương này?</strong>
          <p>Thao tác sẽ xóa chương, các bài học, học liệu và bài trắc nghiệm thuộc chương đó.</p>
        </div>
        <p className="builder-confirm-note">
          Chỉ có thể xóa khi quy tắc của khóa học và nội dung liên quan cho phép.
        </p>
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(-1)}>Hủy</InstructorButton>
          <InstructorButton type="primary" disabled={!canDelete} onClick={handleDelete}>
            Xóa chương
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderModuleDelete;
