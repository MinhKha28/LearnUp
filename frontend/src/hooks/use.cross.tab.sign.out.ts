import { useEffect, useRef } from "react";
import { isSignedOutElsewhere } from "@/services/sign.out";

const PROTECTED_PREFIXES = ["/admin", "/organizer", "/learner", "/instructor"];

/** Builds the storage listener; separate from the hook so it can be unit tested without a DOM. */
export const createCrossTabSignOutListener = (
  onSignedOut: () => void,
  pathname: () => string,
  redirectToLogin: () => void,
) => (event: Pick<StorageEvent, "key" | "newValue">) => {
  if (!isSignedOutElsewhere(event)) return;
  onSignedOut();
  if (PROTECTED_PREFIXES.some((prefix) => pathname().startsWith(prefix))) redirectToLogin();
};

/** UC06: when another tab ends the session, end it here too instead of showing a stale workspace. */
export const useCrossTabSignOut = (onSignedOut: () => void) => {
  const handler = useRef(onSignedOut);
  handler.current = onSignedOut;

  useEffect(() => {
    const listener = createCrossTabSignOutListener(
      () => handler.current(),
      () => window.location.pathname,
      () => window.location.assign("/login"),
    );
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
};
