import { useNavigate, useParams } from "react-router-dom";
import { findInstructorCourse } from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";
import "./course.builder.new.version.scss";

const CourseBuilderNewVersion = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  if (!course) return null;

  return (
    <InstructorPage className="builder-page">
      <div className="new-version-header">
        <div>
          <span className="builder-crumb">Xây dựng khóa học / Phiên bản nháp mới</span>
          <div className="builder-hero">
            <h1>Phiên bản nháp mới</h1>
          </div>
        </div>
        <span className="new-version-pill">{course.version} · Bản nháp</span>
      </div>
      <div className="new-version-grid">
        <div className="new-version-card">
          <h2>
            {course.title} · {course.version}
          </h2>
          <p>Nội dung đào tạo được sao chép từ phiên bản đã khóa.</p>
          <p>Chỉnh sửa cấu trúc của bản nháp trước khi gửi phê duyệt.</p>
          <div className="instructor-info-panel">
            <strong>Sử dụng lại tệp học liệu</strong>
            <p>Tệp học liệu được dùng lại từ phiên bản {course.publishedVersion} mà không nhân đôi dung lượng lưu trữ.</p>
          </div>
          <div className="new-version-actions">
            <InstructorButton
              type="primary"
              onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}
            >
              Kiểm tra phiên bản mới
            </InstructorButton>
          </div>
        </div>
        <div className="new-version-side">
          <span className="new-version-side-eyebrow">Thuộc tính</span>
          <div className="instructor-info-panel">
            <strong>Phiên bản trước</strong>
            <p>
              {course.publishedVersion} vẫn được phát hành cho đến khi phiên bản này được phê duyệt.
            </p>
          </div>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderNewVersion;
