import { describe, expect, it } from "vitest";
import {
  assignmentDue,
  assignmentErrorMessage,
  assignmentProgress,
  extensionDays,
  invalidAssignmentLearners,
  assignmentResultMessage,
} from "@/utils/assignments.view";

describe("UC24 view", () => {
  it("reads 422 error.errors and ignores malformed rows", () => {
    const error = { learnerId: "id", reason: "ALREADY_ASSIGNED" };
    expect(invalidAssignmentLearners({ errors: [error, null, { learnerId: 4, reason: "NOT_A_LEARNER" }, { learnerId: "id", reason: "UNKNOWN" }] })).toEqual([error]);
    expect(invalidAssignmentLearners({})).toEqual([]);
  });
  it("summarizes each backend result count", () => {
    expect(assignmentResultMessage({ created: 1, converted: 2, completedOnAssign: 3, restored: 4 })).toBe("Phân công thành công: 1 tạo mới, 2 chuyển từ tự chọn, 3 đã hoàn thành trước đó, 4 khôi phục.");
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
    "DUE_DATE_TOO_FAR",
    "ASSIGNMENT_INVALID_LEARNERS",
    "CONCURRENT_CHANGE",
    "ENROLLMENT_NOT_EXTENDABLE",
    "ENROLLMENT_NOT_EXEMPTIBLE",
    "ASSIGNMENT_NOT_FOUND",
    "COURSE_NOT_ASSIGNABLE",
    "SUBSCRIPTION_NOT_ACTIVE",
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
