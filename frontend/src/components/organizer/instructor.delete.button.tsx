import { Alert, App, Button, Form, Input, Modal, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import {
  HandOverBlockAlert,
  HandOverReceiverFields,
} from "@/components/organizer/course.handover.fields";
import { OrganizerButton } from "@/components/organizer/organizer.ui";
import {
  deleteInstructorAPI,
  getInstructorDeletionAPI,
} from "@/services/organization.service";
import type {
  AccountStatus,
  IApiError,
  IInstructorDeletion,
} from "@/types/organization.types";
import {
  instructorDeleteErrorMessage,
  instructorDeleteShouldLeavePage,
  instructorDeleteShouldReloadPreview,
} from "@/utils/instructor.delete.view";
import "./instructor.delete.button.scss";

interface InstructorDeleteButtonProps {
  instructorId: string;
  fullName: string;
  status: AccountStatus;
  /** Xóa xong (hoặc tài khoản không còn) -> trang gọi rời chi tiết. */
  onDeleted: () => void;
}

interface DeleteForm {
  receiverInstructorId?: string;
  reason?: string;
}

// UC12.6 - nút Delete trên trang chi tiết Instructor. Mọi trạng thái đều xóa được (BR-46).
// Còn phụ trách chuỗi Course thì phải chọn người tiếp nhận (BR-51, BR-96) như khi vô hiệu hóa.
export const InstructorDeleteButton = ({
  instructorId,
  fullName,
  status,
  onDeleted,
}: InstructorDeleteButtonProps) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<DeleteForm>();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<IInstructorDeletion | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Tài khoản không còn trong tổ chức (xóa ở tab khác): đóng dialog thì rời trang chi tiết.
  const [gone, setGone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await getInstructorDeletionAPI(instructorId);
      if (res.data) {
        setPreview(res.data);
      } else {
        setPreview(null);
        setLoadFailed(true);
        const code = (res as unknown as { error?: IApiError }).error?.code;
        setGone(instructorDeleteShouldLeavePage(code));
      }
    } catch {
      setPreview(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    if (open) loadPreview();
  }, [open, loadPreview]);

  const close = () => {
    setOpen(false);
    setPreview(null);
    setSubmitError(null);
    form.resetFields();
    if (gone) {
      setGone(false);
      onDeleted();
    }
  };

  const submit = async (values: DeleteForm) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await deleteInstructorAPI(instructorId, {
        ...(values.receiverInstructorId && {
          receiverInstructorId: values.receiverInstructorId,
        }),
        ...(values.reason?.trim() && { reason: values.reason.trim() }),
      });
      const result = res.data;
      if (result) {
        const seats = `${result.seats.remaining} of ${result.seats.max} instructor seat(s) available.`;
        if (!result.changed) {
          message.info(`${fullName} was already deleted.`);
        } else if (result.receiver && result.transferredCourses.length > 0) {
          message.success(
            `${fullName} was deleted. ${result.transferredCourses.length} course(s) moved to ${result.receiver.fullName}. ${seats}`,
          );
        } else {
          message.success(`${fullName} was deleted. ${seats}`);
        }
        close();
        onDeleted();
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      if (instructorDeleteShouldLeavePage(code)) {
        message.info(instructorDeleteErrorMessage(code));
        close();
        onDeleted();
        return;
      }
      setSubmitError(instructorDeleteErrorMessage(code));
      if (instructorDeleteShouldReloadPreview(code)) {
        form.setFieldValue("receiverInstructorId", undefined);
        loadPreview();
      }
    } catch {
      setSubmitError("Could not connect to the server. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const courses = preview?.courses ?? [];
  const canSubmit = !loading && !loadFailed && !!preview?.canDelete;

  const renderBody = () => {
    if (loading) return <Skeleton active />;
    if (gone) {
      return (
        <Alert
          type="info"
          showIcon
          message={instructorDeleteErrorMessage("INSTRUCTOR_NOT_FOUND")}
        />
      );
    }
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
    if (preview.blockReason) {
      return (
        <HandOverBlockAlert
          blockReason={preview.blockReason}
          fullName={fullName}
          courses={courses}
          actionPast="deleted"
          onRetry={loadPreview}
        />
      );
    }
    return (
      <>
        <p>
          {status === "Pending"
            ? `${fullName} has not activated the account yet. The invitation link stops working and the seat is released.`
            : `${fullName} will no longer be able to sign in and the seat is released.`}{" "}
          Training records are kept. This cannot be undone; the email can be
          used for a new account afterwards.
        </p>
        {courses.length > 0 && (
          <HandOverReceiverFields
            fullName={fullName}
            courses={courses}
            receivers={preview.receivers}
          />
        )}
      </>
    );
  };

  return (
    <>
      <OrganizerButton danger onClick={() => setOpen(true)}>
        Delete
      </OrganizerButton>
      <Modal
        open={open}
        title="Delete instructor?"
        okText="Delete"
        okButtonProps={{
          danger: true,
          disabled: !canSubmit,
          loading: submitting,
        }}
        cancelText="Cancel"
        onOk={() => form.submit()}
        onCancel={close}
        destroyOnClose
      >
        <Form<DeleteForm> form={form} layout="vertical" onFinish={submit}>
          {renderBody()}
          {canSubmit && (
            <Form.Item name="reason" label="Reason (optional)">
              <Input.TextArea rows={3} maxLength={1000} showCount />
            </Form.Item>
          )}
          {submitError && (
            <Alert
              className="instructor-delete-error"
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
