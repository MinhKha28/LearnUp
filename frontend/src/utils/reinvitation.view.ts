export type InvitedRole = "Instructor" | "Learner";

export const reinvitationErrorMessage = (
  role: InvitedRole,
  code: string | undefined,
): string => {
  switch (code) {
    case "ACCOUNT_NOT_PENDING":
      return `This ${role.toLowerCase()} is no longer waiting for activation, so no invitation was sent.`;
    case "INSTRUCTOR_NOT_FOUND":
    case "LEARNER_NOT_FOUND":
      return `This ${role.toLowerCase()} no longer exists in your organization.`;
    case "CONCURRENT_UPDATE":
      return `This ${role.toLowerCase()} was just updated. Please reload and try again.`;
    case "ORGANIZATION_NOT_ACTIVE":
      return "Your Organization is suspended. Invitations cannot be sent.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Your Subscription is suspended. Invitations cannot be sent until it is renewed.";
    default:
      return "Could not resend the invitation. Please try again later.";
  }
};

export const reinvitationShouldReload = (code: string | undefined): boolean =>
  code === "ACCOUNT_NOT_PENDING" || code === "CONCURRENT_UPDATE";
