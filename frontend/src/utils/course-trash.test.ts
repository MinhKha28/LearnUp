import { describe, expect, it } from "vitest";
import { courseTrashErrorMessage, formatTrashDate, formatTrashRemaining } from "./course-trash";

describe("courseTrashErrorMessage", () => {
  it.each([
    ["delete", "COURSE_NOT_FOUND", "Không tìm thấy khóa học hoặc bạn không có quyền truy cập."],
    ["delete", "COURSE_NOT_DELETABLE", "Chỉ có thể xóa khóa học ở trạng thái bản nháp hoặc bị từ chối."],
    ["delete", "COURSE_LOCKED", "Khóa học đã khóa nên không thể xóa."],
    ["delete", "COURSE_HAS_ENROLLMENT", "Khóa học đã có lịch sử đăng ký học nên không thể xóa."],
    ["delete", "ENROLLMENT_CHECK_UNAVAILABLE", "Không thể xác minh lịch sử đăng ký học. Vui lòng thử lại sau."],
    ["restore", "COURSE_NOT_FOUND", "Không tìm thấy khóa học hoặc bạn không có quyền truy cập."],
    ["restore", "COURSE_DRAFT_VERSION_CONFLICT", "Không thể khôi phục khóa học vì đã tồn tại phiên bản bản nháp, chờ phê duyệt hoặc bị từ chối trong cùng chuỗi phiên bản."],
    ["restore", "COURSE_TRASH_EXPIRED", "Đã hết thời hạn khôi phục 7 ngày."],
    ["permanent", "COURSE_NOT_FOUND", "Không tìm thấy khóa học hoặc bạn không có quyền truy cập."],
    ["permanent", "COURSE_NOT_IN_TRASH", "Khóa học không nằm trong thùng rác."],
  ] as const)("maps %s failure %s", (action, code, message) => {
    expect(courseTrashErrorMessage(code, action)).toBe(message);
  });

  it("uses the permanent deletion fallback for the retired code", () => {
    expect(
      courseTrashErrorMessage("COURSE_DELETION_IN_PROGRESS", "permanent"),
    ).toBe("Không thể xóa vĩnh viễn khóa học. Vui lòng thử lại.");
  });
});


describe("Vietnamese course trash display formatting", () => {
  it("formats the date using Vietnam time", () => {
    expect(formatTrashDate("2026-11-11T17:00:00.000Z")).toBe("12/11/2026");
  });

  it("uses Vietnamese remaining-day labels", () => {
    const now = Date.parse("2026-11-11T00:00:00.000Z");
    expect(formatTrashRemaining("2026-11-12T00:00:00.000Z", now)).toBe("Còn 1 ngày");
    expect(formatTrashRemaining("2026-11-11T00:00:00.000Z", now)).toBe("Đã hết hạn");
  });
});
