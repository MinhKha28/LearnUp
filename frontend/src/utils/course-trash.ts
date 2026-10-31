const DAY_MS = 24 * 60 * 60 * 1000;

export function getRemainingTrashDays(
  purgeAt: string,
  now = Date.now(),
): number {
  const expiresAt = new Date(purgeAt).getTime();

  if (!Number.isFinite(expiresAt)) return 0;

  return Math.max(0, Math.ceil((expiresAt - now) / DAY_MS));
}

export function isTrashExpired(purgeAt: string, now = Date.now()): boolean {
  const expiresAt = new Date(purgeAt).getTime();

  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

export function formatTrashRemaining(
  purgeAt: string,
  now = Date.now(),
): string {
  if (isTrashExpired(purgeAt, now)) {
    return "Expired";
  }

  const days = getRemainingTrashDays(purgeAt, now);

  return days === 1 ? "1 day remaining" : `${days} days remaining`;
}

export function formatTrashDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function courseTrashErrorMessage(
  code: string | undefined,
  action: "delete" | "restore" | "permanent",
): string {
  switch (code) {
    case "COURSE_NOT_FOUND":
      return "Course not found or you do not have access.";

    case "COURSE_NOT_DELETABLE":
      return "Only Draft or Rejected Courses can be deleted.";

    case "COURSE_LOCKED":
      return "This Course is locked and cannot be deleted.";

    case "COURSE_HAS_ENROLLMENT":
      return "This Course has enrollment history and cannot be deleted.";

    case "ENROLLMENT_CHECK_UNAVAILABLE":
      return "Enrollment history could not be verified. Please try again later.";

    case "COURSE_DRAFT_VERSION_CONFLICT":
      return "This Course cannot be restored because another Draft, Submitted, or Rejected version exists in the same chain.";

    case "COURSE_TRASH_EXPIRED":
      return "The 7-day recovery period has expired.";

    case "COURSE_DELETION_IN_PROGRESS":
      return "This Course is currently being permanently deleted.";

    case "COURSE_NOT_IN_TRASH":
      return "This Course is not in Trash.";

    default:
      if (action === "restore") {
        return "Unable to restore this Course. Please try again.";
      }

      if (action === "permanent") {
        return "Unable to permanently delete this Course. Please try again.";
      }

      return "Unable to move this Course to Trash. Please try again.";
  }
}

/**
 * The current LearnUP Axios interceptor may return
 * error payloads instead of throwing HTTP 4xx responses.
 */
export function getCourseApiErrorCode(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const payload = value as {
    error?: { code?: unknown };
    response?: {
      data?: {
        error?: { code?: unknown };
      };
    };
    data?: {
      error?: { code?: unknown };
    };
  };

  const code =
    payload.error?.code ??
    payload.response?.data?.error?.code ??
    payload.data?.error?.code;

  return typeof code === "string" ? code : undefined;
}
