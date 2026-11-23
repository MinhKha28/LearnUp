import { describe, expect, it } from "vitest";
import {
  reinvitationErrorMessage,
  reinvitationShouldReload,
} from "./reinvitation.view";

describe("UC12.7 / UC13.7 re-invitation messages", () => {
  it("explains each backend code for the right role", () => {
    expect(reinvitationErrorMessage("Learner", "ACCOUNT_NOT_PENDING")).toBe(
      "Học viên này không còn chờ kích hoạt nên lời mời không được gửi.",
    );
    expect(reinvitationErrorMessage("Instructor", "INSTRUCTOR_NOT_FOUND")).toBe(
      "Giảng viên này không còn trong tổ chức của bạn.",
    );
    expect(
      reinvitationErrorMessage("Learner", "SUBSCRIPTION_NOT_ACTIVE"),
    ).toContain("cho tới khi gia hạn");
    expect(
      reinvitationErrorMessage("Learner", "ORGANIZATION_NOT_ACTIVE"),
    ).toContain("tạm khóa");
  });

  it("falls back to a generic message and never shows the raw code", () => {
    for (const code of [undefined, "INTERNAL_SERVER_ERROR", "SOMETHING_NEW"]) {
      const text = reinvitationErrorMessage("Learner", code);
      expect(text).toBe("Chưa gửi lại được lời mời. Vui lòng thử lại sau.");
      if (code) expect(text).not.toContain(code);
    }
  });

  it("reloads the detail only when the account state may have changed", () => {
    expect(reinvitationShouldReload("ACCOUNT_NOT_PENDING")).toBe(true);
    expect(reinvitationShouldReload("CONCURRENT_UPDATE")).toBe(true);
    expect(reinvitationShouldReload("SUBSCRIPTION_NOT_ACTIVE")).toBe(false);
    expect(reinvitationShouldReload(undefined)).toBe(false);
  });
});
