import { describe, expect, it } from "vitest";
import { actionLabel, isKnownAction, parseAuditDetails } from "@/utils/audit.log";

/** UC50: every action code Tenant writes today on develop has a word on the audit screen. */
describe("audit codes written by Tenant", () => {
  it.each([
    "INSTRUCTOR_DEACTIVATED",
    "INSTRUCTOR_REACTIVATED",
    "INSTRUCTOR_DELETED",
    "LEARNER_DEACTIVATED",
    "LEARNER_REACTIVATED",
    "LEARNER_DELETED",
    "MEMBER_IMPORTED",
  ])("%s is labelled", (code) => {
    expect(isKnownAction(code)).toBe(true);
    expect(actionLabel(code)).not.toBe(actionLabel("NOT_AN_AUDIT_CODE"));
  });

  it("reads the BR-337 reason the way audit-service requires it", () => {
    expect(parseAuditDetails('{"reason":"Unpaid invoice"}').reason).toBe("Unpaid invoice");
    expect(parseAuditDetails('{"reason":"  "}').reason).toBeUndefined();
  });
});
