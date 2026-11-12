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
        const seats = `Còn ${result.seats.remaining} trên ${result.seats.max} suất Giảng viên.`;
        if (!result.changed) {
          message.info(`${fullName} đã bị xóa trước đó.`);
        } else if (result.receiver && result.transferredCourses.length > 0) {
          message.success(
            `Đã xóa ${fullName}. Đã chuyển ${result.transferredCourses.length} Khóa học cho ${result.receiver.fullName}. ${seats}`,
          );
        } else {
          message.success(`Đã xóa ${fullName}. ${seats}`);
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
      setSubmitError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
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
          message="Không thể tải các Khóa học do Giảng viên này phụ trách."
          action={<Button onClick={loadPreview}>Thử lại</Button>}
        />
      );
    }
    if (preview.blockReason) {
      return (
        <HandOverBlockAlert
          blockReason={preview.blockReason}
          fullName={fullName}
          courses={courses}
          actionPast="xóa"
          onRetry={loadPreview}
        />
      );
    }
    return (
      <>
        <p>
          {status === "Pending"
            ? `${fullName} chưa kích hoạt tài khoản. Liên kết mời sẽ hết hiệu lực và suất tài khoản sẽ được giải phóng.`
            : `${fullName} sẽ không thể đăng nhập và suất tài khoản sẽ được giải phóng.`}{" "}
          Dữ liệu đào tạo vẫn được giữ lại. Thao tác này không thể hoàn tác; sau đó
          email có thể dùng cho tài khoản mới.
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
        Xóa
      </OrganizerButton>
      <Modal
        open={open}
        title="Xóa Giảng viên?"
        okText="Xóa"
        okButtonProps={{
          danger: true,
          disabled: !canSubmit,
          loading: submitting,
        }}
        cancelText="Hủy"
        onOk={() => form.submit()}
        onCancel={close}
        destroyOnClose
      >
        <Form<DeleteForm> form={form} layout="vertical" onFinish={submit}>
          {renderBody()}
          {canSubmit && (
            <Form.Item name="reason" label="Lý do (không bắt buộc)">
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
