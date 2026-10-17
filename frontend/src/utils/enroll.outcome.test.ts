import { describe, expect, it } from "vitest";

import { ApiError } from "@/types/api.types";
import { ENROLL_OUTCOME_MESSAGES, getEnrollOutcomeMessage, resolveEnrollOutcome } from "@/utils/enroll.outcome";

const created = {
  id: "e-new",
  courseId: "c-3",
  enrollmentType: "Optional",
  status: "NotStarted",
  enrolledAt: "2026-10-01T00:00:00.000Z",
} as const;

describe("resolveEnrollOutcome", () => {
  it("201 → enrolled với id vừa tạo", () => {
    expect(resolveEnrollOutcome(created)).toEqual({ kind: "enrolled", enrollmentId: "e-new" });
  });

  it("409 ALREADY_ENROLLED → alreadyEnrolled với details.enrollmentId", () => {
    const error = new ApiError(409, "ALREADY_ENROLLED", "x", { enrollmentId: "e-old" });
    expect(resolveEnrollOutcome(error)).toEqual({ kind: "alreadyEnrolled", enrollmentId: "e-old" });
  });

  it("409 ALREADY_ENROLLED thiếu enrollmentId → retry và gọi lại course-ids", () => {
    expect(resolveEnrollOutcome(new ApiError(409, "ALREADY_ENROLLED", "x"))).toEqual({
      kind: "retry",
      refreshLinks: true,
    });
    expect(resolveEnrollOutcome(new ApiError(409, "ALREADY_ENROLLED", "x", { enrollmentId: 1 }))).toEqual({
      kind: "retry",
      refreshLinks: true,
    });
  });

  it("403 ORGANIZATION_IN_GRACE → inGrace", () => {
    expect(resolveEnrollOutcome(new ApiError(403, "ORGANIZATION_IN_GRACE", "x"))).toEqual({ kind: "inGrace" });
  });

  it("403 khác → forbidden", () => {
    expect(resolveEnrollOutcome(new ApiError(403, "FORBIDDEN", "x"))).toEqual({ kind: "forbidden" });
    expect(resolveEnrollOutcome(new ApiError(403, "HTTP_403", "x"))).toEqual({ kind: "forbidden" });
  });

  it("404 COURSE_NOT_AVAILABLE → unavailable", () => {
    expect(resolveEnrollOutcome(new ApiError(404, "COURSE_NOT_AVAILABLE", "x"))).toEqual({ kind: "unavailable" });
  });

  it("429 RATE_LIMITED uses server seconds and stays separate from retry", () => {
    const outcome = resolveEnrollOutcome(new ApiError(429, "RATE_LIMITED", "x", { retryAfterSeconds: 37 }));
    expect(outcome).toEqual({ kind: "rateLimited", retryAfterSeconds: 37 });
    expect(getEnrollOutcomeMessage(outcome)).toBe("Bạn thao tác quá nhanh, vui lòng thử lại sau 37 giây");
    expect(outcome).not.toHaveProperty("refreshLinks");
  });

  it.each([undefined, null, "37", 0, -1, 0.5, NaN, Infinity])(
    "RATE_LIMITED without valid seconds (%s) uses the approved fallback",
    (retryAfterSeconds) => {
      const outcome = resolveEnrollOutcome(new ApiError(429, "RATE_LIMITED", "x", { retryAfterSeconds }));
      expect(outcome).toEqual({ kind: "rateLimited", retryAfterSeconds: null });
      expect(getEnrollOutcomeMessage(outcome)).toBe("Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút");
    },
  );

  it("RATE_LIMITED without details uses the fallback; existing success messages stay intact", () => {
    expect(getEnrollOutcomeMessage(resolveEnrollOutcome(new ApiError(429, "RATE_LIMITED", "x"))))
      .toBe("Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút");
    expect(getEnrollOutcomeMessage(resolveEnrollOutcome(created))).toBe("Đăng ký thành công");
  });

  it.each([
    [0, "TIMEOUT"],
    [0, "NETWORK"],
    [500, "INTERNAL_ERROR"],
    [502, "HTTP_502"],
    [503, "SERVICE_UNAVAILABLE"],
    [504, "HTTP_504"],
    [400, "VALIDATION_ERROR"],
    [400, "VALIDATION_FAILED"],
    [401, "HTTP_401"],
    [404, "HTTP_404"],
    [409, "CONFLICT"],
  ])("%i %s → retry", (status, code) => {
    expect(resolveEnrollOutcome(new ApiError(status, code, "x"))).toEqual({ kind: "retry", refreshLinks: false });
  });

  it("thông báo tiếng Việt theo từng kết quả", () => {
    expect(ENROLL_OUTCOME_MESSAGES.enrolled).toBe("Đăng ký thành công");
    expect(ENROLL_OUTCOME_MESSAGES.alreadyEnrolled).toBe("Bạn đã đăng ký Course này");
    expect(ENROLL_OUTCOME_MESSAGES.unavailable).toBe("Course không còn trong danh mục");
    expect(ENROLL_OUTCOME_MESSAGES.retry).toBe("Chưa đăng ký được. Vui lòng thử lại.");
  });
});
