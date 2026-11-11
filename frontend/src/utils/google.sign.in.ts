import { signInMessage } from "@/utils/auth";

// UC05.1 error codes returned by Identity (POST /api/v1/auth/google).
const GOOGLE_MESSAGES: Record<string, string> = {
  GOOGLE_ACCOUNT_NOT_LINKED: "This Google email is not linked to an existing LearnUP account.",
  GOOGLE_SIGN_IN_NOT_ALLOWED:
    "Google sign-in is not available for this account. Please sign in with your email and password.",
  GOOGLE_CREDENTIAL_INVALID: "Google sign-in could not be verified. Please try again.",
  GOOGLE_SIGN_IN_UNAVAILABLE:
    "Google sign-in is currently unavailable. Please sign in with your email and password.",
};

export const GOOGLE_UNAVAILABLE_MESSAGE = GOOGLE_MESSAGES.GOOGLE_SIGN_IN_UNAVAILABLE;

/** Google-specific codes first; account/Organization/Subscription denials reuse the UC05 wording. */
export const googleSignInMessage = (code?: string | null): string =>
  (code && GOOGLE_MESSAGES[code]) || signInMessage(code);
