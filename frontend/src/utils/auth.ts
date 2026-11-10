import type { UserRole } from "@/types/identity.types";
import { clearVideoPositionSession } from "@/utils/video.position";

export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

const HOME_BY_ROLE: Record<UserRole, string> = {
  ADMIN: "/admin",
  ORGANIZER: "/organizer",
  INSTRUCTOR: "/instructor",
  LEARNER: "/learner",
};

export const homePathForRole = (role?: string | null): string =>
  (role && HOME_BY_ROLE[role as UserRole]) || "/";

export const safeRedirect = (target: string | null): string | null =>
  target && target.startsWith("/") && !target.startsWith("//") ? target : null;

export const saveTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

const SIGN_IN_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Check your email and password, then try again.",
  ACCOUNT_NOT_FOUND: "Check your email and password, then try again.",
  ACCOUNT_NOT_ACTIVE:
    "Your account is not active yet. Organizers: complete payment for your registration. Invited members: open the invitation email to set your password.",
  ACCOUNT_DEACTIVATED:
    "Your account has been deactivated. Contact your organization's Organizer.",
  ORGANIZATION_SUSPENDED:
    "Your organization has been suspended by LearnUP. Contact your Organizer.",
  ORGANIZATION_NOT_ACTIVE: "Your organization is not active.",
  SUBSCRIPTION_SUSPENDED:
    "Your organization's subscription is suspended. Contact your Organizer to renew.",
  SUBSCRIPTION_ENDED: "Your organization has no active subscription.",
  REFRESH_TOKEN_REUSED:
    "Your session was ended for security reasons. Please sign in again.",
  TOO_MANY_ATTEMPTS:
    "Too many failed sign-in attempts. Try again in 15 minutes or reset your password.",
  TENANT_UNAVAILABLE:
    "Sign-in is temporarily unavailable. Please try again in a moment.",
};

export const signInMessage = (code?: string | null): string =>
  (code && SIGN_IN_MESSAGES[code]) ||
  "Check your email and password, then try again.";

export const isSignInReason = (code: string | null): code is string =>
  Boolean(code && SIGN_IN_MESSAGES[code]);

export const clearTokens = () => {
  clearVideoPositionSession();
  window.dispatchEvent(new Event("auth-cleared"));
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};
