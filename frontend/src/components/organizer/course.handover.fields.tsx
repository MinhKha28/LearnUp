import { Button, Form, Select } from "antd";
import type {
  IManagedCourseChain,
  IStatusChangeReceiver,
} from "@/types/organization.types";
import { courseStatusText } from "@/utils/organizer.labels";
import "./course.handover.fields.scss";
import { VietnameseAlert } from "@/components/vietnamese.controls";

// BR-51 / BR-96 - phần chung của modal vô hiệu hóa (UC12.5) và dialog xóa (UC12.6):
// danh sách chuỗi Course còn phụ trách, Alert khi bị chặn và ô chọn Instructor tiếp nhận.

export const CourseList = ({ courses }: { courses: IManagedCourseChain[] }) => (
  <ul className="instructor-status-courses">
    {courses.map((course) => (
      <li key={course.chainId}>
        <strong>{course.name}</strong> · v{course.versionNumber} ·{" "}
        {courseStatusText(course.status)}
      </li>
    ))}
  </ul>
);

interface HandOverBlockAlertProps {
  blockReason: "COURSE_SERVICE_UNAVAILABLE" | "NO_VALID_RECEIVER";
  fullName: string;
  courses: IManagedCourseChain[];
  /** Động từ quá khứ cho câu "cannot be ... until": "deactivated" | "deleted". */
  actionPast: string;
  onRetry: () => void;
}

/** Alert khi không làm tiếp được: course-service lỗi, hoặc không còn Instructor hợp lệ nào để tiếp nhận. */
export const HandOverBlockAlert = ({
  blockReason,
  fullName,
  courses,
  actionPast,
  onRetry,
}: HandOverBlockAlertProps) =>
  blockReason === "COURSE_SERVICE_UNAVAILABLE" ? (
    <VietnameseAlert
      type="warning"
      showIcon
      message="Tạm thời không xem được thông tin khóa học"
      description={`Chưa thể ${actionPast} giảng viên này cho đến khi kiểm tra được các khóa học họ phụ trách.`}
      action={<Button onClick={onRetry}>Thử lại</Button>}
    />
  ) : (
    <VietnameseAlert
      type="error"
      showIcon
      message="Không có giảng viên nào có thể tiếp nhận các khóa học này"
      description={
        <>
          <p>
            {fullName} vẫn đang phụ trách các khóa học bên dưới và chưa có
            giảng viên đang hoạt động nào khác trong tổ chức có thể tiếp nhận. Hãy
            thêm hoặc kích hoạt lại một giảng viên trước.
          </p>
          <CourseList courses={courses} />
        </>
      }
    />
  );

interface ReceiverFieldsProps {
  fullName: string;
  courses: IManagedCourseChain[];
  receivers: IStatusChangeReceiver[];
}

/** Danh sách chuỗi sẽ chuyển + ô chọn người tiếp nhận (form field receiverInstructorId, bắt buộc). */
export const HandOverReceiverFields = ({
  fullName,
  courses,
  receivers,
}: ReceiverFieldsProps) => (
  <>
    <VietnameseAlert
      type="info"
      showIcon
      message={`${fullName} đang phụ trách ${courses.length} khóa học. Các khóa học này, cùng mọi phiên bản, sẽ được chuyển cho giảng viên bạn chọn.`}
      description={<CourseList courses={courses} />}
    />
    <Form.Item
      className="instructor-status-receiver"
      name="receiverInstructorId"
      label="Giảng viên tiếp nhận"
      rules={[{ required: true, message: "Chọn một giảng viên." }]}
    >
      <Select
        showSearch
        placeholder="Chọn giảng viên đang hoạt động"
        optionFilterProp="label"
        options={receivers.map((receiver) => ({
          value: receiver.id,
          label: `${receiver.fullName} (${receiver.email})`,
        }))}
      />
    </Form.Item>
  </>
);
