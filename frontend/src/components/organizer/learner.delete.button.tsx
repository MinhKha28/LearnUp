import { App, Form, Input, Modal } from "antd";
import { useState } from "react";
import { OrganizerButton } from "@/components/organizer/organizer.ui";
import { deleteLearnerAPI } from "@/services/organization.service";
import type { AccountStatus, IApiError } from "@/types/organization.types";
import {
  learnerDeleteErrorMessage,
  learnerDeleteShouldLeavePage,
} from "@/utils/learner.delete.view";
import "./learner.delete.button.scss";
import { VietnameseAlert } from "@/components/vietnamese.controls";

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

// UC13.6 - nút Delete trên trang chi tiết Learner. Mọi trạng thái đều xóa được (BR-46).
// Learner không có chuyển quyền phụ trách (BR-51 chỉ cho Instructor) nên dialog chỉ là xác nhận + lý do.
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
          message.info(`${fullName} đã bị xóa trước đó.`);
        } else {
          message.success(
            `Đã xóa ${fullName}. Còn ${result.seats.remaining} trên ${result.seats.max} suất học viên.`,
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
      setSubmitError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <OrganizerButton danger onClick={() => setOpen(true)}>
        Xóa
      </OrganizerButton>
      <Modal
        open={open}
        title="Xóa học viên?"
        okText="Xóa"
        okButtonProps={{ danger: true, loading: submitting }}
        cancelText="Hủy"
        onOk={() => form.submit()}
        onCancel={close}
        destroyOnClose
      >
        <Form<DeleteForm> form={form} layout="vertical" onFinish={submit}>
          <p>
            {status === "Pending"
              ? `${fullName} chưa kích hoạt tài khoản. Liên kết mời sẽ hết hiệu lực và suất tài khoản sẽ được giải phóng.`
              : `${fullName} sẽ không thể đăng nhập và suất tài khoản sẽ được giải phóng.`}{" "}
            Dữ liệu đào tạo và chứng chỉ đã cấp vẫn được giữ lại. Thao tác này không
            thể hoàn tác; sau đó email có thể dùng cho tài khoản mới.
          </p>
          <Form.Item name="reason" label="Lý do (không bắt buộc)">
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
          {submitError && (
            <VietnameseAlert
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
