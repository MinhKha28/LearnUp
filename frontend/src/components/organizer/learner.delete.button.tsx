import { Alert, App, Form, Input, Modal } from "antd";
import { useState } from "react";
import { OrganizerButton } from "@/components/organizer/organizer.ui";
import { deleteLearnerAPI } from "@/services/organization.service";
import type { AccountStatus, IApiError } from "@/types/organization.types";
import {
  learnerDeleteErrorMessage,
  learnerDeleteShouldLeavePage,
} from "@/utils/learner.delete.view";
import "./learner.delete.button.scss";

interface LearnerDeleteButtonProps {
  learnerId: string;
  fullName: string;
  status: AccountStatus;
  /** Xóa xong (hoặc tài khoản không còn) -> trang gọi rời chi tiết. */
  onDeleted: () => void;
}

interface DeleteForm {
  reason?: string;
}

// UC13.6 - nút Delete trên trang chi tiết Learner. Mọi trạng thái đều xóa được (BR-37).
// Learner không có chuyển quyền phụ trách (BR-41 chỉ cho Instructor) nên dialog chỉ là xác nhận + lý do.
export const LearnerDeleteButton = ({
  learnerId,
  fullName,
  status,
  onDeleted,
}: LearnerDeleteButtonProps) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<DeleteForm>();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setSubmitError(null);
    form.resetFields();
  };

  const submit = async (values: DeleteForm) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await deleteLearnerAPI(learnerId, {
        ...(values.reason?.trim() && { reason: values.reason.trim() }),
      });
      const result = res.data;
      if (result) {
        if (!result.changed) {
          message.info(`${fullName} was already deleted.`);
        } else {
          message.success(
            `${fullName} was deleted. ${result.seats.remaining} of ${result.seats.max} learner seat(s) available.`,
          );
        }
        close();
        onDeleted();
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      if (learnerDeleteShouldLeavePage(code)) {
        message.info(learnerDeleteErrorMessage(code));
        close();
        onDeleted();
        return;
      }
      setSubmitError(learnerDeleteErrorMessage(code));
    } catch {
      setSubmitError("Could not connect to the server. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <OrganizerButton danger onClick={() => setOpen(true)}>
        Delete
      </OrganizerButton>
      <Modal
        open={open}
        title="Delete learner?"
        okText="Delete"
        okButtonProps={{ danger: true, loading: submitting }}
        cancelText="Cancel"
        onOk={() => form.submit()}
        onCancel={close}
        destroyOnClose
      >
        <Form<DeleteForm> form={form} layout="vertical" onFinish={submit}>
          <p>
            {status === "Pending"
              ? `${fullName} has not activated the account yet. The invitation link stops working and the seat is released.`
              : `${fullName} will no longer be able to sign in and the seat is released.`}{" "}
            Training records and issued certificates are kept. This cannot be
            undone; the email can be used for a new account afterwards.
          </p>
          <Form.Item name="reason" label="Reason (optional)">
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
          {submitError && (
            <Alert
              className="learner-delete-error"
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
