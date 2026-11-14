import { materialTypeText } from "@/utils/builder.material.labels";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderResource,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderMaterialDeleteBlocked = () => {
  const { courseId, lessonId, materialId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const found = structure ? findBuilderResource(structure, lessonId, materialId) : undefined;

  if (!course || !found) return null;

  const { resource } = found;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Xây dựng khóa học / Không thể xóa học liệu</span>
      <div className="builder-hero">
        <h1>Không thể xóa học liệu</h1>
      </div>
      <div className="builder-banner">
        <strong>Không được phép xóa</strong>
        <p>Khóa học đã khóa; xóa học liệu có thể ảnh hưởng đến điều kiện hoàn thành.</p>
      </div>
      <div className="builder-update-card">
        <h2>{resource.title}</h2>
        <p className="builder-lesson-intro">
          {resource.required ? "Bắt buộc" : "Không bắt buộc"} • {materialTypeText(resource.type === "video" ? "Video" : "Reading")}{" "}
          • {resource.sizeLabel === "[Size]" ? "Chưa xác định dung lượng" : resource.sizeLabel}
        </p>
        <p className="builder-lesson-intro">Để thay đổi cấu trúc khóa học, hãy tạo phiên bản mới.</p>
        <div className="builder-actions">
          <InstructorButton onClick={() => navigate(-1)}>Quay lại</InstructorButton>
          <InstructorButton
            type="primary"
            onClick={() =>
              navigate(`/instructor/courses/${course.id}/edit`, { state: { newVersion: true } })
            }
          >
            Tạo phiên bản mới
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderMaterialDeleteBlocked;
