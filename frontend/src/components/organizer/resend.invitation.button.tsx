import { App, Popconfirm } from "antd";
import { useState } from "react";
import { OrganizerButton } from "@/components/organizer/organizer.ui";
import {
  resendInstructorInvitationAPI,
  resendLearnerInvitationAPI,
} from "@/services/organization.service";
import type { IApiError } from "@/types/organization.types";
import { formatDateVN } from "@/utils/helper";
import {
  reinvitationErrorMessage,
  reinvitationShouldReload,
  type InvitedRole,
} from "@/utils/reinvitation.view";

interface ResendInvitationButtonProps {
  role: InvitedRole;
  accountId: string;
  email: string;
  onChanged: () => void;
}

export const ResendInvitationButton = ({
  role,
  accountId,
  email,
  onChanged,
}: ResendInvitationButtonProps) => {
  const { message } = App.useApp();
  const [sending, setSending] = useState(false);

  const resend = async () => {
    setSending(true);
    try {
      const res =
        role === "Instructor"
          ? await resendInstructorInvitationAPI(accountId)
          : await resendLearnerInvitationAPI(accountId);
      if (res.data?.invitation) {
        message.success(
          `Lời mời mới sẽ được gửi tới ${email}, có hiệu lực tới ngày ${formatDateVN(res.data.invitation.expiresAt)}.`,
        );
        onChanged();
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      message.error(reinvitationErrorMessage(role, code));
      if (reinvitationShouldReload(code)) onChanged();
    } catch {
      message.error("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Popconfirm
      title="Gửi lại lời mời?"
      description="Liên kết mới sẽ được gửi qua email và liên kết trước đó không còn dùng được."
      okText="Gửi lại"
      cancelText="Hủy"
      onConfirm={resend}
    >
      <OrganizerButton loading={sending}>Gửi lại lời mời</OrganizerButton>
    </Popconfirm>
  );
};
