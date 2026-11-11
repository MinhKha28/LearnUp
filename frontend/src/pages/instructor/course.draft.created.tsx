import { message } from "antd";
import { InstructorPage, PageHeader, SuccessScreen } from "@/components/instructor/instructor.ui";
import "./course.create.scss";

const CourseDraftCreated = () => {
  return (
    <InstructorPage className="instructor-course-create">
      <PageHeader
        eyebrow="Giảng viên"
        title="Đã tạo khóa học bản nháp"
        subtitle="Tiếp tục xây dựng chương, bài học và bài đánh giá."
      />
      <SuccessScreen
        tone="success"
        title="Khóa học bản nháp đã sẵn sàng"
        primary={{
          label: "Mở trình xây dựng khóa học",
          onClick: () => message.info("Course Builder arrives in a later batch."),
        }}
      >
        <p>Thêm nội dung học tập trước khi gửi phê duyệt.</p>
      </SuccessScreen>
    </InstructorPage>
  );
};

export default CourseDraftCreated;
