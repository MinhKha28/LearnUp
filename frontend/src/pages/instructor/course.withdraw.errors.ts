export const getWithdrawErrorCode = (response: unknown): string | null => {
  if (!response || typeof response !== "object") {
    return null;
  }

  const value = response as Record<string, unknown>;

  if (typeof value.code === "string") {
    return value.code;
  }

  if (value.error && typeof value.error === "object") {
    const error = value.error as Record<string, unknown>;

    if (typeof error.code === "string") {
      return error.code;
    }
  }

  if (value.response && typeof value.response === "object") {
    const nested = value.response as Record<string, unknown>;
    return getWithdrawErrorCode(nested.data ?? nested);
  }

  return null;
};

const errorMessages: Record<string, string> = {
  FORBIDDEN: "You do not have permission to withdraw this Course.",
  COURSE_NOT_FOUND: "Course not found.",
  INVALID_COURSE_STATUS:
    "Only a Submitted Course awaiting approval can be withdrawn.",
  COURSE_CHANGED: "Course status has changed. Please reload and try again.",
};

export const getWithdrawErrorMessage = (response: unknown): string => {
  const code = getWithdrawErrorCode(response);

  return (
    (code && errorMessages[code]) ||
    "Unable to withdraw Course. Please try again."
  );
};
