import { Alert, Button, Form, Select } from "antd";
import type {
  IManagedCourseChain,
  IStatusChangeReceiver,
} from "@/types/organization.types";
import "./course.handover.fields.scss";

// BR-51 / BR-96 - phần chung của modal vô hiệu hóa (UC12.5) và dialog xóa (UC12.6):
// danh sách chuỗi Course còn phụ trách, Alert khi bị chặn và ô chọn Instructor tiếp nhận.

export const CourseList = ({ courses }: { courses: IManagedCourseChain[] }) => (
  <ul className="instructor-status-courses">
    {courses.map((course) => (
      <li key={course.chainId}>
        <strong>{course.name}</strong> · v{course.versionNumber} ·{" "}
        {course.status}
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
    <Alert
      type="warning"
      showIcon
      message="Tạm thời không xem được thông tin Khóa học"
      description={`Chưa thể ${actionPast} Giảng viên này cho đến khi kiểm tra được các Khóa học họ phụ trách.`}
      action={<Button onClick={onRetry}>Thử lại</Button>}
    />
  ) : (
    <Alert
      type="error"
      showIcon
      message="Không có Giảng viên nào có thể tiếp nhận các Khóa học này"
      description={
        <>
          <p>
            {fullName} vẫn đang phụ trách các Khóa học bên dưới và chưa có
            Giảng viên đang hoạt động nào khác trong tổ chức có thể tiếp nhận. Hãy
            thêm hoặc kích hoạt lại một Giảng viên trước.
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
    <Alert
      type="info"
      showIcon
      message={`${fullName} đang phụ trách ${courses.length} Khóa học. Các Khóa học này, cùng mọi phiên bản, sẽ được chuyển cho Giảng viên bạn chọn.`}
      description={<CourseList courses={courses} />}
    />
    <Form.Item
      className="instructor-status-receiver"
      name="receiverInstructorId"
      label="Giảng viên tiếp nhận"
      rules={[{ required: true, message: "Chọn một Giảng viên." }]}
    >
      <Select
        showSearch
        placeholder="Chọn Giảng viên đang hoạt động"
        optionFilterProp="label"
        options={receivers.map((receiver) => ({
          value: receiver.id,
          label: `${receiver.fullName} (${receiver.email})`,
        }))}
      />
    </Form.Item>
  </>
);
