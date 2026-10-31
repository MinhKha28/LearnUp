import { describe, expect, it } from "vitest";
import {
  reinvitationErrorMessage,
  reinvitationShouldReload,
} from "./reinvitation.view";

describe("UC12.7 / UC13.7 re-invitation messages", () => {
  it("explains each backend code for the right role", () => {
    expect(reinvitationErrorMessage("Learner", "ACCOUNT_NOT_PENDING")).toBe(
      "This learner is no longer waiting for activation, so no invitation was sent.",
    );
    expect(reinvitationErrorMessage("Instructor", "INSTRUCTOR_NOT_FOUND")).toBe(
      "This instructor no longer exists in your organization.",
    );
    expect(
      reinvitationErrorMessage("Learner", "SUBSCRIPTION_NOT_ACTIVE"),
    ).toContain("until it is renewed");
    expect(
      reinvitationErrorMessage("Learner", "ORGANIZATION_NOT_ACTIVE"),
    ).toContain("suspended");
  });

  it("falls back to a generic message and never shows the raw code", () => {
    for (const code of [undefined, "INTERNAL_SERVER_ERROR", "SOMETHING_NEW"]) {
      const text = reinvitationErrorMessage("Learner", code);
      expect(text).toBe(
        "Could not resend the invitation. Please try again later.",
      );
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
