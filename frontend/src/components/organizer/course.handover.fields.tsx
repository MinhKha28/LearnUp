import { Alert, Button, Form, Select } from "antd";
import type {
  IManagedCourseChain,
  IStatusChangeReceiver,
} from "@/types/organization.types";
import "./course.handover.fields.scss";

// BR-41 / BR-287 - phần chung của modal vô hiệu hóa (UC12.5) và dialog xóa (UC12.6):
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
      message="Course information is temporarily unavailable"
      description={`The instructor cannot be ${actionPast} until we can check the courses they manage.`}
      action={<Button onClick={onRetry}>Try again</Button>}
    />
  ) : (
    <Alert
      type="error"
      showIcon
      message="No instructor can take over these courses"
      description={
        <>
          <p>
            {fullName} still manages the courses below and no other active
            instructor in your organization can take them over. Add or
            reactivate an instructor first.
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
      message={`${fullName} manages ${courses.length} course(s). They will be moved, with all their versions, to the instructor you choose.`}
      description={<CourseList courses={courses} />}
    />
    <Form.Item
      className="instructor-status-receiver"
      name="receiverInstructorId"
      label="Take over by"
      rules={[{ required: true, message: "Choose an instructor." }]}
    >
      <Select
        showSearch
        placeholder="Choose an active instructor"
        optionFilterProp="label"
        options={receivers.map((receiver) => ({
          value: receiver.id,
          label: `${receiver.fullName} (${receiver.email})`,
        }))}
      />
    </Form.Item>
  </>
);
