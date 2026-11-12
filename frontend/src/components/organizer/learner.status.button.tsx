import { Alert, App, Form, Input, Modal } from "antd";
import { useState } from "react";
import { OrganizerButton } from "@/components/organizer/organizer.ui";
import { changeLearnerStatusAPI } from "@/services/organization.service";
import type { AccountStatus, IApiError } from "@/types/organization.types";
import {
  learnerStatusErrorMessage,
  learnerStatusShouldReloadPage,
  type LearnerStatusAction,
} from "@/utils/learner.status.view";
import "./learner.status.button.scss";

interface LearnerStatusButtonProps {
  learnerId: string;
  fullName: string;
  status: AccountStatus;
  activatedAt: string | null;
  onChanged: () => void;
}

interface StatusForm {
  reason?: string;
}

// UC13.5 - nút Deactivate / Reactivate trên trang chi tiết Learner.
// Chỉ tài khoản ĐÃ kích hoạt mới có nút (Pending hoặc chưa từng kích hoạt: dùng Xóa - UC13.6).
export const LearnerStatusButton = ({
  learnerId,
  fullName,
  status,
  activatedAt,
  onChanged,
}: LearnerStatusButtonProps) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<StatusForm>();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const action: LearnerStatusAction | null = !activatedAt
    ? null
    : status === "Active"
      ? "DEACTIVATE"
      : status === "Deactivated"
        ? "REACTIVATE"
        : null;

  if (!action) return null;

  const close = () => {
    setOpen(false);
    setSubmitError(null);
    form.resetFields();
  };

  const submit = async (values: StatusForm) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await changeLearnerStatusAPI(learnerId, {
        action,
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
        } else if (action === "DEACTIVATE") {
          message.success(`Đã vô hiệu hóa tài khoản của ${fullName}.`);
        } else {
          message.success(`${fullName} có thể đăng nhập trở lại.`);
        }
        close();
        onChanged();
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      setSubmitError(learnerStatusErrorMessage(action, code));
      if (learnerStatusShouldReloadPage(code)) onChanged();
    } catch {
      setSubmitError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  const isDeactivate = action === "DEACTIVATE";

  return (
    <>
      <OrganizerButton danger={isDeactivate} onClick={() => setOpen(true)}>
        {isDeactivate ? "Vô hiệu hóa" : "Kích hoạt lại"}
      </OrganizerButton>
      <Modal
        open={open}
        title={isDeactivate ? "Vô hiệu hóa học viên?" : "Kích hoạt lại học viên?"}
        okText={isDeactivate ? "Vô hiệu hóa" : "Kích hoạt lại"}
        okButtonProps={{ danger: isDeactivate, loading: submitting }}
        cancelText="Hủy"
        onOk={() => form.submit()}
        onCancel={close}
        destroyOnClose
      >
        <Form<StatusForm> form={form} layout="vertical" onFinish={submit}>
          {isDeactivate ? (
            <p>
              {fullName} sẽ không thể đăng nhập. Dữ liệu học tập vẫn được giữ lại,
              các lượt ghi danh không bị tính là quá hạn và suất tài khoản không
              được giải phóng.
            </p>
          ) : (
            <p>
              {fullName} will be able to sign in again and continue their
              courses.
            </p>
          )}
          <Form.Item name="reason" label="Lý do (không bắt buộc)">
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
          {submitError && (
            <Alert
              className="learner-status-error"
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
