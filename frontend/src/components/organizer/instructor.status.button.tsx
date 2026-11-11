import { Alert, App, Button, Form, Input, Modal, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import {
  HandOverBlockAlert,
  HandOverReceiverFields,
} from "@/components/organizer/course.handover.fields";
import { OrganizerButton } from "@/components/organizer/organizer.ui";
import {
  changeInstructorStatusAPI,
  getInstructorStatusChangeAPI,
} from "@/services/organization.service";
import type {
  AccountStatus,
  IApiError,
  IInstructorStatusChange,
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
              ? `Tài khoản của ${fullName} đã bị vô hiệu hóa trước đó.`
              : `Tài khoản của ${fullName} đang hoạt động.`,
          );
        } else if (action === "REACTIVATE") {
          message.success(`${fullName} có thể đăng nhập trở lại.`);
        } else if (result.receiver && result.transferredCourses.length > 0) {
          message.success(
            `Đã vô hiệu hóa tài khoản của ${fullName}. Đã chuyển ${result.transferredCourses.length} Khóa học cho ${result.receiver.fullName}.`,
          );
        } else {
          message.success(`Đã vô hiệu hóa tài khoản của ${fullName}.`);
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
      setSubmitError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
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
          message="Không thể tải các Khóa học do Giảng viên này phụ trách."
          action={<Button onClick={loadPreview}>Thử lại</Button>}
        />
      );
    }
    switch (preview.blockReason) {
      case "COURSE_SERVICE_UNAVAILABLE":
      case "NO_VALID_RECEIVER":
        return (
          <HandOverBlockAlert
            blockReason={preview.blockReason}
            fullName={fullName}
            courses={courses}
            actionPast="vô hiệu hóa"
            onRetry={loadPreview}
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
                : `Tài khoản của ${fullName} đã bị vô hiệu hóa trước đó.`
            }
          />
        );
      default:
        break;
    }
    return (
      <>
        <p>
          {fullName} sẽ không thể đăng nhập. Dữ liệu học tập vẫn được giữ lại
          và suất tài khoản không được giải phóng.
        </p>
        {needsReceiver && (
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
      <OrganizerButton
        danger={action === "DEACTIVATE"}
        onClick={() => setOpen(true)}
      >
        {action === "DEACTIVATE" ? "Vô hiệu hóa" : "Kích hoạt lại"}
      </OrganizerButton>
      <Modal
        open={open}
        title={
          action === "DEACTIVATE"
            ? "Vô hiệu hóa Giảng viên?"
            : "Kích hoạt lại Giảng viên?"
        }
        okText={action === "DEACTIVATE" ? "Vô hiệu hóa" : "Kích hoạt lại"}
        okButtonProps={{
          danger: action === "DEACTIVATE",
          disabled: !canSubmit,
          loading: submitting,
        }}
        cancelText="Hủy"
        onOk={() => form.submit()}
        onCancel={close}
        destroyOnClose
      >
        <Form<StatusForm> form={form} layout="vertical" onFinish={submit}>
          {action === "DEACTIVATE" ? (
            renderDeactivateBody()
          ) : (
            <p>
              {fullName} sẽ có thể đăng nhập lại. Các Khóa học đã chuyển cho Giảng viên
              khác vẫn thuộc về họ.
            </p>
          )}
          {canSubmit && (
            <Form.Item name="reason" label="Lý do (không bắt buộc)">
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
