import { useNavigate, useParams } from "react-router-dom";
import {
  canCreateNewCourseVersion,
  courseVersionRecords,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, PageHeader } from "@/components/instructor/instructor.ui";
import "./course.versions.scss";

const CourseVersions = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  if (!course) {
    return (
      <InstructorPage className="instructor-course-versions">
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

  const records = courseVersionRecords(course);

  return (
    <InstructorPage className="instructor-course-versions">
      <PageHeader
        eyebrow="Khóa học / Phiên bản"
        title="Chuỗi phiên bản khóa học"
        subtitle="Xem các phiên bản và khóa học đang được phát hành."
        back
        actions={
          canCreateNewCourseVersion(course) ? (
            <InstructorButton
              type="primary"
              onClick={() => navigate(`/instructor/courses/${course.id}/versions/new`)}
            >
              Tạo phiên bản mới
            </InstructorButton>
          ) : undefined
        }
      />
      <div className="instructor-versions-table">
        <div className="instructor-versions-row instructor-versions-head">
          <span>Phiên bản</span>
          <span>Trạng thái</span>
          <span>Ngày tạo</span>
          <span>Đã phát hành</span>
          <span>Đang học</span>
          <span>Đã hoàn thành</span>
          <span>Chứng chỉ</span>
        </div>
        {records.length === 0 && (
          <div className="instructor-versions-row">
            <span>Khóa học này chưa được phát hành.</span>
          </div>
        )}
        {records.map((record) => (
          <div className="instructor-versions-row" key={record.version}>
            <strong>{record.version}</strong>
            <span>{record.statusLabel}</span>
            <span>{record.createdDate}</span>
            <span>{record.publishedDate}</span>
            <span>{record.learners}</span>
            <span>{record.completed}</span>
            <span>{record.certificates}</span>
          </div>
        ))}
      </div>
      <div className="instructor-versions-note">
        <strong>Quy tắc phiên bản</strong>
        <p>Khi phiên bản mới được phát hành, phiên bản trước chuyển sang trạng thái đã lưu trữ.</p>
      </div>
      <p className="instructor-versions-footnote">
        Học viên đã đăng ký vẫn tiếp tục học trên phiên bản khóa học ban đầu.
      </p>
    </InstructorPage>
  );
};

export default CourseVersions;
