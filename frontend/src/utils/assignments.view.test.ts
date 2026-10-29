import { describe, expect, it } from "vitest";
import {
  assignmentDue,
  assignmentErrorMessage,
  assignmentProgress,
  extensionDays,
  invalidAssignmentLearners,
  assignmentResultMessage,
  assignmentExtensionRange,
  extensionDateError,
  canExemptAssignment,
  canExtendAssignment,
  assignmentCalendarDay,
} from "@/utils/assignments.view";

describe("UC24 view", () => {
  const timezone = "Asia/Ho_Chi_Minh";
  const now = new Date("2026-10-16T17:00:00Z");
  it("uses organization today rather than UTC today", () => {
    expect(assignmentCalendarDay(now, timezone)).toBe("2026-10-17");
    expect(
      assignmentExtensionRange("2026-01-01T17:00:00Z", timezone, now),
    ).toEqual({ min: "2026-10-17" });
  });
  it("requires the day after the current end date", () => {
    expect(
      assignmentExtensionRange("2026-10-20T17:00:00Z", timezone, now).min,
    ).toBe("2026-10-21");
    expect(
      extensionDateError("2026-10-20", "2026-10-20T17:00:00Z", timezone, now),
    ).toBe("DUE_DATE_NOT_LATER");
    expect(
      extensionDateError("2026-10-21", "2026-10-20T17:00:00Z", timezone, now),
    ).toBeNull();
  });
  it("accepts today and distant future dates, rejects past dates", () => {
    const due = "2026-01-01T17:00:00Z";
    expect(extensionDateError("2026-10-17", due, timezone, now)).toBeNull();
    expect(extensionDateError("2027-10-17", due, timezone, now)).toBeNull();
    expect(extensionDateError("2026-10-16", due, timezone, now)).toBe(
      "DUE_DATE_IN_PAST",
    );
    for (const day of ["2027-10-18", "2100-12-31", "9999-12-31"])
      expect(extensionDateError(day, due, timezone, now)).toBeNull();
  });
  it("today and distant current deadlines start on the following day", () => {
    expect(
      assignmentExtensionRange("2026-10-17T17:00:00Z", timezone, now).min,
    ).toBe("2026-10-18");
    const range = assignmentExtensionRange(
      "2027-10-17T17:00:00Z",
      timezone,
      now,
    );
    expect(range).toEqual({ min: "2027-10-18" });
  });
  it("adds calendar days across DST and leap year", () => {
    expect(
      assignmentExtensionRange(
        "2028-03-12T05:00:00Z",
        "America/New_York",
        new Date("2028-03-11T12:00:00Z"),
      ),
    ).toEqual({ min: "2028-03-12" });
    expect(
      assignmentExtensionRange(null, "UTC", new Date("2028-02-29T12:00:00Z"))
        .min,
    ).toBe("2028-02-29");
  });
  it("null timezone uses the device calendar", () => {
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(assignmentCalendarDay(now, null)).toBe(expected);
    expect(assignmentExtensionRange(null, null, now).min).toBe(expected);
  });
  it.each([
    "NotStarted",
    "InProgress",
    "Overdue",
    "Completed",
    "Exempted",
    "Halted",
    "Withdrawn",
  ] as const)(
    "gates actions for %s including overdue without activity",
    (status) => {
      expect(canExemptAssignment({ status, firstActivityAt: null })).toBe(
        false,
      );
      expect(
        canExemptAssignment({ status, firstActivityAt: "2026-01-01Z" }),
      ).toBe(["InProgress", "Overdue"].includes(status));
      expect(canExtendAssignment(status)).toBe(
        !["Completed", "Withdrawn"].includes(status),
      );
    },
  );
  it("reads 422 error.errors and ignores malformed rows", () => {
    const error = { learnerId: "id", reason: "ALREADY_ASSIGNED" };
    expect(
      invalidAssignmentLearners({
        errors: [
          error,
          null,
          { learnerId: 4, reason: "NOT_A_LEARNER" },
          { learnerId: "id", reason: "UNKNOWN" },
        ],
      }),
    ).toEqual([error]);
    expect(invalidAssignmentLearners({})).toEqual([]);
  });
  it("summarizes each backend result count", () => {
    expect(
      assignmentResultMessage({
        created: 1,
        converted: 2,
        completedOnAssign: 3,
        restored: 4,
      }),
    ).toBe(
      "Phân công thành công: 1 tạo mới, 2 chuyển từ tự chọn, 3 đã hoàn thành trước đó, 4 khôi phục.",
    );
  });
  it("D24 uses the day before local midnight", () => {
    expect(assignmentDue("2026-10-16T17:00:00Z", "Asia/Ho_Chi_Minh")).toBe(
      "Hết ngày 16/10/2026",
    );
  });
  it("missing timezone explicitly describes device time", () => {
    expect(assignmentDue("2026-10-16T17:00:00Z", null)).toContain(
      "giờ trên máy bạn",
    );
  });
  it("D25 hides zero total and shows mandatory resource counts", () => {
    expect(
      assignmentProgress({ requiredCompleted: 0, requiredTotal: 0 }),
    ).toBeNull();
    expect(assignmentProgress({ requiredCompleted: 2, requiredTotal: 3 })).toBe(
      "2/3 học liệu bắt buộc",
    );
  });
  it.each([
    [0, 0],
    [86400, 1],
    [129600, 1.5],
    [90000, 25 / 24],
  ])("converts %i seconds into days", (seconds, days) => {
    expect(extensionDays(seconds)).toBeCloseTo(days);
  });
  it.each([
    "NOT_IN_ORGANIZATION",
    "NOT_A_LEARNER",
    "ACCOUNT_DELETED",
    "ACCOUNT_DEACTIVATED",
    "ALREADY_ASSIGNED",
    "DUE_DATE_NOT_LATER",
    "DUE_DATE_IN_PAST",
    "ASSIGNMENT_INVALID_LEARNERS",
    "CONCURRENT_CHANGE",
    "ENROLLMENT_NOT_EXTENDABLE",
    "ENROLLMENT_NOT_EXEMPTIBLE",
    "ASSIGNMENT_NOT_FOUND",
    "COURSE_NOT_ASSIGNABLE",
    "SUBSCRIPTION_NOT_ACTIVE",
    "ORGANIZATION_NOT_ACTIVE",
    "FORBIDDEN",
    "NETWORK",
    "TIMEOUT",
    "INTERNAL_ERROR",
    "SERVICE_UNAVAILABLE",
  ])("translates %s", (code) => {
    expect(assignmentErrorMessage(code)).not.toBe(
      assignmentErrorMessage("UNKNOWN"),
    );
    expect(assignmentErrorMessage(code)).not.toContain(code);
  });
});

it("explains inactive organizations for assignment create, extend and exempt", () => {
  expect(assignmentErrorMessage("ORGANIZATION_NOT_ACTIVE")).toBe(
    "Tổ chức hiện không hoạt động. Vui lòng liên hệ quản trị viên nền tảng.",
  );
});
