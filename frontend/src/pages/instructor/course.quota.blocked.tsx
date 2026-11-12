import { useNavigate } from "react-router-dom";
import { InstructorPage, PageHeader, SuccessScreen } from "@/components/instructor/instructor.ui";

const CourseQuotaBlocked = () => {
  const navigate = useNavigate();

  return (
    <InstructorPage className="instructor-course-quota-blocked">
      <PageHeader
        eyebrow="Khóa học của tôi / Tạo mới"
        title="Đã đạt giới hạn khóa học"
        subtitle="Tổ chức đã đạt giới hạn số khóa học theo gói dịch vụ."
      />
      <SuccessScreen
        tone="warning"
        title="Không thể tạo thêm khóa học"
        secondary={{
          label: "Quay lại khóa học của tôi",
          onClick: () => navigate("/instructor/courses"),
        }}
      >
        <p>Hãy liên hệ quản lý đào tạo về giới hạn khóa học của gói dịch vụ.</p>
      </SuccessScreen>
    </InstructorPage>
  );
};

export default CourseQuotaBlocked;
