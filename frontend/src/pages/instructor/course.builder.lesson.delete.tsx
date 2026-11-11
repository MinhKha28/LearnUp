import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  findCourseStructure,
  findInstructorCourse,
  removeBuilderLesson,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";
import "./course.builder.confirm.scss";

const CourseBuilderLessonDelete = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);

  if (!course || !structure) return null;

  const base = `/instructor/courses/${course.id}/builder`;
  const canDelete = !course.locked;

  const handleDelete = () => {
    if (!lessonId) return;
    removeBuilderLesson(structure, lessonId);
    message.success("Lesson deleted.");
    navigate(base);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Xây dựng khóa học / Xóa bài học</span>
      <div className="builder-hero">
        <h1>Xóa bài học</h1>
      </div>
      <div className="builder-confirm-card">
        <div className="builder-confirm-warning">
          <strong>Xóa bài học này?</strong>
          <p>Thao tác sẽ xóa bài học cùng toàn bộ video và tài liệu đọc liên quan.</p>
        </div>
        <p className="builder-confirm-note">
          Chỉ có thể xóa khi quy tắc của khóa học và nội dung liên quan cho phép.
        </p>
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(-1)}>Hủy</InstructorButton>
          <InstructorButton type="primary" disabled={!canDelete} onClick={handleDelete}>
            Xóa bài học
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderLessonDelete;
