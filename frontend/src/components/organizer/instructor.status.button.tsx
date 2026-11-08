import { Alert, App, Button, Form, Input, Modal, Select, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { OrganizerButton } from "@/components/organizer/organizer.ui";
import {
  changeInstructorStatusAPI,
  getInstructorStatusChangeAPI,
} from "@/services/organization.service";
import type {
  AccountStatus,
  IApiError,
  IInstructorStatusChange,
  IManagedCourseChain,
} from "@/types/organization.types";
import {
  instructorStatusErrorMessage,
  instructorStatusShouldReloadPage,
  instructorStatusShouldReloadPreview,
  type StatusAction,
} from "@/utils/instructor.status.view";
import "./instructor.status.button.scss";

interface InstructorStatusButtonProps {
  instructorId: string;
  fullName: string;
  status: AccountStatus;
  activatedAt: string | null;
  onChanged: () => void;
}

interface StatusForm {
  receiverInstructorId?: string;
  reason?: string;
}

const CourseList = ({ courses }: { courses: IManagedCourseChain[] }) => (
  <ul className="instructor-status-courses">
    {courses.map((course) => (
      <li key={course.chainId}>
        <strong>{course.name}</strong> · v{course.versionNumber} ·{" "}
        {course.status}
      </li>
    ))}
  </ul>
);

// UC12.5 - nút Deactivate / Reactivate trên trang chi tiết Instructor.
// Chỉ tài khoản ĐÃ kích hoạt mới có nút (Pending hoặc chưa từng kích hoạt: dùng Xóa - UC12.6).
export const InstructorStatusButton = ({
  instructorId,
  fullName,
  status,
  activatedAt,
  onChanged,
}: InstructorStatusButtonProps) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<StatusForm>();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<IInstructorStatusChange | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const action: StatusAction | null = !activatedAt
    ? null
    : status === "Active"
      ? "DEACTIVATE"
      : status === "Deactivated"
        ? "REACTIVATE"
        : null;

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await getInstructorStatusChangeAPI(instructorId);
      if (res.data) {
        setPreview(res.data);
      } else {
        setPreview(null);
        setLoadFailed(true);
      }
    } catch {
      setPreview(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    if (open && action === "DEACTIVATE") loadPreview();
  }, [open, action, loadPreview]);

  if (!action) return null;

  const close = () => {
    setOpen(false);
    setPreview(null);
    setSubmitError(null);
    form.resetFields();
  };

  const submit = async (values: StatusForm) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await changeInstructorStatusAPI(instructorId, {
        action,
        ...(values.receiverInstructorId && {
          receiverInstructorId: values.receiverInstructorId,
        }),
        ...(values.reason?.trim() && { reason: values.reason.trim() }),
      });
      const result = res.data;
      if (result) {
        if (!result.changed) {
          message.info(
            action === "DEACTIVATE"
              ? `${fullName} is already deactivated.`
              : `${fullName} is already active.`,
          );
        } else if (action === "REACTIVATE") {
          message.success(`${fullName} can sign in again.`);
        } else if (result.receiver && result.transferredCourses.length > 0) {
          message.success(
            `${fullName} was deactivated. ${result.transferredCourses.length} course(s) moved to ${result.receiver.fullName}.`,
          );
        } else {
          message.success(`${fullName} was deactivated.`);
        }
        close();
        onChanged();
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      setSubmitError(instructorStatusErrorMessage(action, code));
      if (instructorStatusShouldReloadPreview(code)) {
        form.setFieldValue("receiverInstructorId", undefined);
        loadPreview();
      }
      if (instructorStatusShouldReloadPage(code)) onChanged();
    } catch {
      setSubmitError("Could not connect to the server. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const courses = preview?.courses ?? [];
  const needsReceiver = courses.length > 0;
  const canSubmit =
    action === "REACTIVATE" ||
    (!loading && !loadFailed && !!preview?.canDeactivate);

  const renderDeactivateBody = () => {
    if (loading) return <Skeleton active />;
    if (loadFailed || !preview) {
      return (
        <Alert
          type="error"
          showIcon
          message="Could not load the courses this instructor manages."
          action={<Button onClick={loadPreview}>Try again</Button>}
        />
      );
    }
    switch (preview.blockReason) {
      case "COURSE_SERVICE_UNAVAILABLE":
        return (
          <Alert
            type="warning"
            showIcon
            message="Course information is temporarily unavailable"
            description="The instructor cannot be deactivated until we can check the courses they manage."
            action={<Button onClick={loadPreview}>Try again</Button>}
          />
        );
      case "NO_VALID_RECEIVER":
        return (
          <Alert
            type="error"
            showIcon
            message="No instructor can take over these courses"
            description={
              <>
                <p>
                  {fullName} still manages the courses below and no other
                  active instructor in your organization can take them over.
                  Add or reactivate an instructor first.
                </p>
                <CourseList courses={courses} />
              </>
            }
          />
        );
      case "ACCOUNT_NOT_ACTIVATED":
      case "ALREADY_DEACTIVATED":
        return (
          <Alert
            type="info"
            showIcon
            message={
              preview.blockReason === "ACCOUNT_NOT_ACTIVATED"
                ? instructorStatusErrorMessage(
                    "DEACTIVATE",
                    "ACCOUNT_NOT_ACTIVATED",
                  )
                : `${fullName} is already deactivated.`
            }
          />
        );
      default:
        break;
    }
    return (
      <>
        <p>
          {fullName} will no longer be able to sign in. Learning data is kept
          and the seat is not released.
        </p>
        {needsReceiver && (
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
                options={preview.receivers.map((receiver) => ({
                  value: receiver.id,
                  label: `${receiver.fullName} (${receiver.email})`,
                }))}
              />
            </Form.Item>
          </>
        )}
      </>
    );
  };

  return (
    <>
      <OrganizerButton
        danger={action === "DEACTIVATE"}
        onClick={() => setOpen(true)}
      >
        {action === "DEACTIVATE" ? "Deactivate" : "Reactivate"}
      </OrganizerButton>
      <Modal
        open={open}
        title={
          action === "DEACTIVATE"
            ? "Deactivate instructor?"
            : "Reactivate instructor?"
        }
        okText={action === "DEACTIVATE" ? "Deactivate" : "Reactivate"}
        okButtonProps={{
          danger: action === "DEACTIVATE",
          disabled: !canSubmit,
          loading: submitting,
        }}
        cancelText="Cancel"
        onOk={() => form.submit()}
        onCancel={close}
        destroyOnClose
      >
        <Form<StatusForm> form={form} layout="vertical" onFinish={submit}>
          {action === "DEACTIVATE" ? (
            renderDeactivateBody()
          ) : (
            <p>
              {fullName} will be able to sign in again. Courses moved to other
              instructors stay with them.
            </p>
          )}
          {canSubmit && (
            <Form.Item name="reason" label="Reason (optional)">
              <Input.TextArea rows={3} maxLength={1000} showCount />
            </Form.Item>
          )}
          {submitError && (
            <Alert
              className="instructor-status-error"
              type="error"
              showIcon
              message={submitError}
            />
          )}
        </Form>
      </Modal>
    </>
  );
};
