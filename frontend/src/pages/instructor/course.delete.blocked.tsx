import { useNavigate, useParams } from "react-router-dom";
import { InstructorPage, PageHeader, SuccessScreen } from "@/components/instructor/instructor.ui";

const CourseDeleteBlocked = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  return (
    <InstructorPage className="instructor-course-delete-blocked">
      <PageHeader
        eyebrow="Giảng viên"
        title="Không thể xóa khóa học"
        subtitle="Khóa học đã có lịch sử học hoặc không ở trạng thái bản nháp/bị từ chối."
      />
      <SuccessScreen
        tone="error"
        title="Không được phép xóa"
        secondary={{
          label: "Quay lại khóa học",
          onClick: () => navigate(`/instructor/courses/${courseId}`),
        }}
      >
        <p>Không thể xóa khóa học đã từng có người đăng ký học.</p>
      </SuccessScreen>
    </InstructorPage>
  );
};

export default CourseDeleteBlocked;
