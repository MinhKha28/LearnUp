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
          `A new invitation will be sent to ${email}. It expires on ${formatDateVN(res.data.invitation.expiresAt)}.`,
        );
        onChanged();
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      message.error(reinvitationErrorMessage(role, code));
      if (reinvitationShouldReload(code)) onChanged();
    } catch {
      message.error("Could not connect to the server. Please try again later.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Popconfirm
      title="Resend invitation?"
      description="A new link will be emailed and the previous link will stop working."
      okText="Resend"
      cancelText="Cancel"
      onConfirm={resend}
    >
      <OrganizerButton loading={sending}>Resend invitation</OrganizerButton>
    </Popconfirm>
  );
};
