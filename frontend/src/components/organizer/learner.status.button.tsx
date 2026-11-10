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
              ? `${fullName} is already deactivated.`
              : `${fullName} is already active.`,
          );
        } else if (action === "DEACTIVATE") {
          message.success(`${fullName} was deactivated.`);
        } else {
          message.success(`${fullName} can sign in again.`);
        }
        close();
        onChanged();
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      setSubmitError(learnerStatusErrorMessage(action, code));
      if (learnerStatusShouldReloadPage(code)) onChanged();
    } catch {
      setSubmitError("Could not connect to the server. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const isDeactivate = action === "DEACTIVATE";

  return (
    <>
      <OrganizerButton danger={isDeactivate} onClick={() => setOpen(true)}>
        {isDeactivate ? "Deactivate" : "Reactivate"}
      </OrganizerButton>
      <Modal
        open={open}
        title={isDeactivate ? "Deactivate learner?" : "Reactivate learner?"}
        okText={isDeactivate ? "Deactivate" : "Reactivate"}
        okButtonProps={{ danger: isDeactivate, loading: submitting }}
        cancelText="Cancel"
        onOk={() => form.submit()}
        onCancel={close}
        destroyOnClose
      >
        <Form<StatusForm> form={form} layout="vertical" onFinish={submit}>
          {isDeactivate ? (
            <p>
              {fullName} will no longer be able to sign in. Learning data is
              kept, enrollments are not counted as overdue, and the seat is not
              released.
            </p>
          ) : (
            <p>
              {fullName} will be able to sign in again and continue their
              courses.
            </p>
          )}
          <Form.Item name="reason" label="Reason (optional)">
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
