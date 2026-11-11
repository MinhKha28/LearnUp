import { formatDateVN } from "@/utils/helper";

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
    return "Đã hết hạn";
  }

  const days = getRemainingTrashDays(purgeAt, now);

  return days === 1 ? "Còn 1 ngày" : `Còn ${days} ngày`;
}

export function formatTrashDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return formatDateVN(value);
}

export function courseTrashErrorMessage(
  code: string | undefined,
  action: "delete" | "restore" | "permanent",
): string {
  switch (code) {
    case "COURSE_NOT_FOUND":
      return "Không tìm thấy khóa học hoặc bạn không có quyền truy cập.";

    case "COURSE_NOT_DELETABLE":
      return "Chỉ có thể xóa khóa học ở trạng thái bản nháp hoặc bị từ chối.";

    case "COURSE_LOCKED":
      return "Khóa học đã khóa nên không thể xóa.";

    case "COURSE_HAS_ENROLLMENT":
      return "Khóa học đã có lịch sử đăng ký học nên không thể xóa.";

    case "ENROLLMENT_CHECK_UNAVAILABLE":
      return "Không thể xác minh lịch sử đăng ký học. Vui lòng thử lại sau.";

    case "COURSE_DRAFT_VERSION_CONFLICT":
      return "Không thể khôi phục khóa học vì đã tồn tại phiên bản bản nháp, chờ phê duyệt hoặc bị từ chối trong cùng chuỗi phiên bản.";

    case "COURSE_TRASH_EXPIRED":
      return "Đã hết thời hạn khôi phục 7 ngày.";

    case "COURSE_NOT_IN_TRASH":
      return "Khóa học không nằm trong thùng rác.";

    default:
      if (action === "restore") {
        return "Không thể khôi phục khóa học. Vui lòng thử lại.";
      }

      if (action === "permanent") {
        return "Không thể xóa vĩnh viễn khóa học. Vui lòng thử lại.";
      }

      return "Không thể chuyển khóa học vào thùng rác. Vui lòng thử lại.";
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
