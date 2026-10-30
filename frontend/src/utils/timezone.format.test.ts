import { afterEach, describe, expect, it, vi } from "vitest";
import { formatTimezone } from "./timezone.format";

afterEach(() => vi.restoreAllMocks());

describe("readable timezone names at an instant", () => {
  it.each([
    ["America/New_York", "2026-07-01T12:00:00Z", "giờ miền Đông (GMT-4)"],
    ["America/New_York", "2026-01-01T12:00:00Z", "giờ miền Đông (GMT-5)"],
    ["Asia/Ho_Chi_Minh", "2026-07-01T12:00:00Z", "giờ Đông Dương (GMT+7)"],
    ["Pacific/Auckland", "2026-01-01T12:00:00Z", "giờ New Zealand (GMT+13)"],
    ["Pacific/Auckland", "2026-07-01T12:00:00Z", "giờ New Zealand (GMT+12)"],
  ])("formats %s at %s", (zone, instant, expected) => {
    const label = formatTimezone(zone, new Date(instant));
    expect(label).toBe(expected);
    expect(label).not.toContain(zone);
  });
  it.each(["", "GMT-4", "America/New_York", "EST", "???", "\ufffd", "giờ\u0001"])("falls back to a readable city when generic name is %j", generic => {
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockImplementation(function (this: Intl.DateTimeFormat, instant) {
      return this.resolvedOptions().timeZoneName === "longGeneric"
        ? [{ type: "timeZoneName", value: generic }]
        : original.call(this, instant);
    });
    expect(formatTimezone("America/New_York", new Date("2026-07-01T12:00:00Z"))).toBe("giờ New York (GMT-4)");
  });
  it("does not expose an invalid identifier", () => {
    expect(formatTimezone("Invalid/Raw_Zone", new Date())).toBe("múi giờ không xác định");
  });
});
