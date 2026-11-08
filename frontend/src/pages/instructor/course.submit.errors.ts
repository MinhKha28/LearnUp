type SubmitErrorBody = {
  code?: string;
  message?: string | string[];
};

export const getSubmitErrorCode = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;

  const value = response as Record<string, unknown>;
  if (typeof value.code === "string") return value.code;

  if (value.error && typeof value.error === "object") {
    const error = value.error as SubmitErrorBody;
    if (typeof error.code === "string") return error.code;
  }

  if (value.response && typeof value.response === "object") {
    const nested = value.response as Record<string, unknown>;
    return getSubmitErrorCode(nested.data ?? nested);
  }

  return null;
};

const submitErrorMessages: Record<string, string> = {
  INCOMPLETE_COURSE:
    "Please complete all required Course information before submission.",
  QUIZ_WITHOUT_QUESTIONS:
    "One or more Quizzes have no questions. Please review them before submitting.",
  COURSE_CHANGED:
    "This Course has been modified. Please reload and try again.",
  ASSESSMENT_UNAVAILABLE:
    "Unable to validate Course Quizzes. Please try again later.",
  INVALID_ASSESSMENT_RESPONSE:
    "Unable to validate Course Quizzes. Please try again later.",
  INVALID_COURSE_STATUS:
    "Only Draft or Rejected Courses can be submitted.",
  FORBIDDEN:
    "You do not have permission to submit this Course.",
};

export const getSubmitErrorMessage = (response: unknown): string => {
  const code = getSubmitErrorCode(response);
  return (code && submitErrorMessages[code]) ||
    "Unable to submit Course. Please try again.";
};

