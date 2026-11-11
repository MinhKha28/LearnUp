import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  canCreateNewCourseVersion,
  createNewCourseVersion,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, PageHeader } from "@/components/instructor/instructor.ui";
import "./course.version.create.scss";

const detailRows = [
  { label: "Cấu trúc", value: "Modules, Lessons, Quizzes and Assignment copied" },
  { label: "Loại", value: "Public or Private carried forward" },
  { label: "Lưu trữ", value: "Source learning files referenced, without duplicate storage" },
  { label: "Phê duyệt", value: "New Draft must be submitted for Organizer review" },
];

const CourseVersionCreate = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  if (!course) {
    return (
      <InstructorPage className="instructor-version-create">
        <PageHeader
          eyebrow="Khóa học / Phiên bản"
          title="Không tìm thấy khóa học"
          subtitle="Khóa học này có thể đã bị xóa."
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Quay lại khóa học của tôi
        </InstructorButton>
      </InstructorPage>
    );
  }

  if (!canCreateNewCourseVersion(course)) {
    return (
      <InstructorPage className="instructor-version-create">
        <PageHeader
          eyebrow="Khóa học / Phiên bản"
          title="Đã có phiên bản mới đang được thực hiện"
          subtitle="Hãy hoàn tất hoặc gửi phê duyệt phiên bản bản nháp hiện tại trước."
          back
        />
        <InstructorButton onClick={() => navigate(`/instructor/courses/${course.id}/versions`)}>
          Quay lại chuỗi phiên bản
        </InstructorButton>
      </InstructorPage>
    );
  }

  const nextVersion = `v${(Number.parseInt(course.version.replace(/[^0-9]/g, ""), 10) || 1) + 1}`;

  const handleCreate = () => {
    createNewCourseVersion(course);
    message.success(`Draft ${course.version} created.`);
    navigate(`/instructor/courses/${course.id}/builder/new-version`);
  };

  return (
    <InstructorPage className="instructor-version-create">
      <PageHeader
        eyebrow="Khóa học / Phiên bản"
        title="Tạo phiên bản khóa học mới"
        subtitle="Sao chép khóa học đã khóa thành phiên bản bản nháp mới."
        back
      />
      <div className="instructor-version-create-card">
        <span className="instructor-version-create-label">Nguồn</span>
        <h2>
          {course.title} · {course.version} · Locked
        </h2>
        <div className="instructor-version-create-rows">
          {detailRows.map((row) => (
            <div className="instructor-version-create-row" key={row.label}>
              <strong>{row.label}</strong>
              <span>{row.value}</span>
            </div>
          ))}
        </div>
        <div className="instructor-version-create-actions">
          <InstructorButton type="primary" onClick={handleCreate}>
            Create Draft {nextVersion}
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseVersionCreate;
