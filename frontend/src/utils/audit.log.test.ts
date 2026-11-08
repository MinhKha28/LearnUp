import { describe, expect, it } from "vitest";

import {
  AUDIT_ACTION_CODES,
  actionLabel,
  actorRoleLabel,
  auditTime,
  dayEndExclusiveInstant,
  dayStartInstant,
  formatAuditTime,
  hasAuditFilter,
  isKnownAction,
  isKnownTargetType,
  parseAuditDetails,
  rangeIsReversed,
  readAuditFilter,
  shortId,
  targetTypeLabel,
  validDay,
} from "./audit.log";

describe("labels", () => {
  it("names the action types the services write and shows any other code as it is", () => {
    expect(actionLabel("INSTRUCTOR_DEACTIVATED")).toBe("Ngừng hoạt động tài khoản giảng viên");
    expect(actionLabel("INSTRUCTOR_REACTIVATED")).toBe("Kích hoạt lại tài khoản giảng viên");
    expect(actionLabel("SOMETHING_NEW")).toBe("Hành động khác");
    expect(actionLabel("constructor")).toBe("Hành động khác"); // not a word of the table
    expect(isKnownAction("INSTRUCTOR_DEACTIVATED")).toBe(true);
    expect(isKnownAction("toString")).toBe(false);
  });

  it("names the roles, and an entry without a role is the system", () => {
    expect(actorRoleLabel("ORGANIZER")).toBe("Quản trị viên tổ chức");
    expect(actorRoleLabel("ADMIN")).toBe("Quản trị viên nền tảng");
    expect(actorRoleLabel("INSTRUCTOR")).toBe("Giảng viên");
    expect(actorRoleLabel("LEARNER")).toBe("Học viên");
    expect(actorRoleLabel(null)).toBe("Hệ thống");
    expect(actorRoleLabel("SOMETHING")).toBe("SOMETHING");
  });

  it("names the target types", () => {
    expect(targetTypeLabel("User")).toBe("Tài khoản");
    expect(targetTypeLabel("Gadget")).toBe("Đối tượng khác");
    expect(isKnownTargetType("User")).toBe(true);
    expect(isKnownTargetType("Gadget")).toBe(false);
    expect(targetTypeLabel(null)).toBe("—");
  });

  it("shortens an id to its last characters", () => {
    expect(shortId("0199a000-0000-7000-8000-0a0000000001")).toBe("…00000001");
    expect(shortId(null)).toBe("—");
  });
});

describe("the words of the action types (BR-336)", () => {
  it("every action type of the table has a Vietnamese sentence-case label, not its code and not all capitals", () => {
    expect(AUDIT_ACTION_CODES.length).toBeGreaterThanOrEqual(24);
    for (const code of AUDIT_ACTION_CODES) {
      const label = actionLabel(code);
      expect(label, code).not.toBe(code);
      expect(label, code).not.toBe("Hành động khác");
      expect(label, code).toMatch(/^\p{Lu}/u); // starts with a capital
      expect(label, code).not.toBe(label.toUpperCase()); // but is not all capitals
      expect(label, code).not.toMatch(/[_]/);
    }
  });

  it("two codes never share a label (the screen would not tell the actions apart)", () => {
    const labels = AUDIT_ACTION_CODES.map(actionLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("the code is kept as the code: the codes are ENTITY_PAST_TENSE capitals", () => {
    for (const code of AUDIT_ACTION_CODES) expect(code).toMatch(/^[A-Z]+(_[A-Z]+)+$/);
  });
});

describe("details", () => {
  it("reads the reason and the time of the action", () => {
    const details = JSON.stringify({ reason: "  Vi phạm nội quy ", occurredAt: "2026-11-02T03:04:05.000Z", chainIds: [] });
    expect(parseAuditDetails(details)).toEqual({ reason: "Vi phạm nội quy", occurredAt: "2026-11-02T03:04:05.000Z" });
  });

  it("is not an error when there is no reason, a blank one, a bad time or a text that is not JSON", () => {
    expect(parseAuditDetails(null)).toEqual({});
    expect(parseAuditDetails("")).toEqual({});
    expect(parseAuditDetails("not json")).toEqual({});
    expect(parseAuditDetails("[1,2]")).toEqual({});
    expect(parseAuditDetails("123")).toEqual({});
    expect(parseAuditDetails(JSON.stringify({ reason: "   ", occurredAt: "yesterday" }))).toEqual({
      reason: undefined,
      occurredAt: undefined,
    });
    expect(parseAuditDetails(JSON.stringify({ reason: 5 }))).toEqual({ reason: undefined, occurredAt: undefined });
  });

  it("shows the time of the action when the service said it, else the time the entry arrived", () => {
    const createdAt = "2026-11-02T10:00:00Z";
    expect(auditTime({ details: JSON.stringify({ occurredAt: "2026-11-02T03:00:00Z" }), createdAt })).toBe("2026-11-02T03:00:00Z");
    expect(auditTime({ details: "{}", createdAt })).toBe(createdAt);
    expect(auditTime({ details: null, createdAt })).toBe(createdAt);
  });
});

describe("times", () => {
  it("writes a time as dd/MM/yyyy HH:mm in Vietnam time, whatever the time zone of the machine", () => {
    expect(formatAuditTime("2026-11-02T17:30:00Z")).toBe("03/11/2026 00:30");
    expect(formatAuditTime("2026-11-02T00:00:00Z")).toBe("02/11/2026 07:00");
    expect(formatAuditTime("2026-12-31T16:59:00Z")).toBe("31/12/2026 23:59");
    expect(formatAuditTime("2026-12-31T17:00:00Z")).toBe("01/01/2027 00:00");
  });

  it("shows a dash for a value that is not a time", () => {
    expect(formatAuditTime("nope")).toBe("—");
  });

  it("accepts only real calendar days", () => {
    expect(validDay("2026-11-08")).toBe("2026-11-08");
    expect(validDay("2028-02-29")).toBe("2028-02-29");
    expect(validDay("2026-02-29")).toBeUndefined();
    expect(validDay("2026-13-01")).toBeUndefined();
    expect(validDay("2026-11-31")).toBeUndefined();
    expect(validDay("08/11/2026")).toBeUndefined();
    expect(validDay("2026-11-8")).toBeUndefined();
    expect(validDay("")).toBeUndefined();
    expect(validDay(null)).toBeUndefined();
  });

  it("turns a day into the instants the server expects: from the start of the day to the start of the next one", () => {
    expect(dayStartInstant("2026-11-08")).toBe("2026-11-07T17:00:00.000Z");
    expect(dayEndExclusiveInstant("2026-11-08")).toBe("2026-11-08T17:00:00.000Z");
    expect(dayEndExclusiveInstant("2026-12-31")).toBe("2026-12-31T17:00:00.000Z");
    expect(dayEndExclusiveInstant("2026-02-28")).toBe("2026-02-28T17:00:00.000Z");
  });
});

describe("the filter in the URL", () => {
  it("reads the target and the days, trimmed", () => {
    const filter = readAuditFilter(new URLSearchParams("type=%20User%20&target=abc&from=2026-11-01&to=2026-11-08&page=3"));
    expect(filter).toEqual({ targetResourceType: "User", targetResourceId: "abc", from: "2026-11-01", to: "2026-11-08" });
  });

  it("drops blank text and bad days instead of sending them", () => {
    const filter = readAuditFilter(new URLSearchParams("type=%20%20&target=&from=2026-02-30&to=hôm-nay"));
    expect(filter).toEqual({ targetResourceType: undefined, targetResourceId: undefined, from: undefined, to: undefined });
    expect(hasAuditFilter(filter)).toBe(false);
  });

  it("cuts a target id longer than the column", () => {
    const filter = readAuditFilter(new URLSearchParams(`target=${"x".repeat(400)}`));
    expect(filter.targetResourceId).toHaveLength(255);
  });

  it("knows a reversed range, and that one day is fine", () => {
    expect(rangeIsReversed({ from: "2026-11-08", to: "2026-11-01" })).toBe(true);
    expect(rangeIsReversed({ from: "2026-11-08", to: "2026-11-08" })).toBe(false);
    expect(rangeIsReversed({ from: "2026-11-08" })).toBe(false);
    expect(rangeIsReversed({})).toBe(false);
    expect(hasAuditFilter({ from: "2026-11-08" })).toBe(true);
  });
});
