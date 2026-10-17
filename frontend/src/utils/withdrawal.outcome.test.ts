import { describe, expect, it } from "vitest";

import { ApiError } from "@/types/api.types";
import type { EnrollmentStatus, EnrollmentType } from "@/utils/learner.labels";
import { canWithdrawEnrollment, resolveWithdrawalOutcome, WITHDRAWAL_MESSAGES } from "@/utils/withdrawal.outcome";

const types: EnrollmentType[] = ["Required", "Optional"];
const statuses: EnrollmentStatus[] = ["NotStarted", "InProgress", "Completed", "Overdue", "Exempted", "Halted", "Withdrawn"];

describe("withdrawal eligibility", () => {
  it.each(types.flatMap((enrollmentType) => statuses.map((status) => ({ enrollmentType, status }))))(
    "$enrollmentType × $status",
    (item) => {
      const expected = item.enrollmentType === "Optional" && ["NotStarted", "InProgress", "Halted"].includes(item.status);
      expect(canWithdrawEnrollment(item)).toBe(expected);
    },
  );
});

describe("withdrawal outcomes", () => {
  it.each([
    ["DELETED", "deleted", "Đã rút khỏi Course"],
    ["WITHDRAWN", "withdrawn", "Đã rút khỏi Course. Tiến độ được giữ lại nếu bạn đăng ký lại"],
  ] as const)("200 %s reloads the list", (outcome, kind, text) => {
    const resolved = resolveWithdrawalOutcome({ outcome });
    expect(resolved).toEqual({ kind, reload: true, retry: false });
    expect(WITHDRAWAL_MESSAGES[resolved.kind]).toBe(text);
  });

  it.each([
    [404, "ENROLLMENT_NOT_FOUND", {}, "notFound", true, false, "Course này không còn trong danh sách của bạn"],
    [409, "ENROLLMENT_NOT_WITHDRAWABLE", { reason: "REQUIRED" }, "required", false, false, "Course được phân công không thể tự rút"],
    [409, "ENROLLMENT_NOT_WITHDRAWABLE", { reason: "COMPLETED" }, "completed", false, false, "Course đã hoàn thành không thể rút"],
    [503, "ASSESSMENT_UNAVAILABLE", {}, "unavailable", false, true, "Chưa kiểm tra được kết quả đánh giá, vui lòng thử lại"],
    [409, "ENROLLMENT_NOT_WITHDRAWABLE", { reason: "UNKNOWN" }, "retry", false, true, "Chưa rút được khỏi Course, vui lòng thử lại"],
    [0, "NETWORK", {}, "retry", false, true, "Chưa rút được khỏi Course, vui lòng thử lại"],
    [500, "UNKNOWN", {}, "retry", false, true, "Chưa rút được khỏi Course, vui lòng thử lại"],
  ] as const)("%s %s → %s", (status, code, details, kind, reload, retry, text) => {
    const outcome = resolveWithdrawalOutcome(new ApiError(status, code, "server text", details));
    expect(outcome).toEqual({ kind, reload, retry });
    expect(WITHDRAWAL_MESSAGES[outcome.kind]).toBe(text);
  });
});
