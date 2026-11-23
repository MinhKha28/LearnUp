import { describe, expect, it } from "vitest";
import { formatDateTimeVN, formatDateVN } from "@/utils/helper";

describe("formatDateTimeVN", () => {
  it("puts the date first, then the time, in Vietnam time (UTC+7)", () => {
    expect(formatDateTimeVN("2026-11-07T07:03:18Z")).toBe("07/11/2026 14:03");
  });

  it("pads day, month, hour and minute with zero", () => {
    expect(formatDateTimeVN("2026-01-02T02:05:00Z")).toBe("02/01/2026 09:05");
  });

  it("moves to the next day when Vietnam time is past midnight", () => {
    expect(formatDateTimeVN("2026-09-24T17:30:00Z")).toBe("25/09/2026 00:30");
    expect(formatDateTimeVN("2026-12-31T17:00:00Z")).toBe("01/01/2027 00:00");
  });

  it("uses a 24-hour clock", () => {
    expect(formatDateTimeVN("2026-11-07T15:45:00Z")).toBe("07/11/2026 22:45");
  });

  it("reads an offset in the value, not the time zone of the browser", () => {
    expect(formatDateTimeVN("2026-11-07T14:03:00+07:00")).toBe(
      "07/11/2026 14:03",
    );
  });

  it("shows a dash when there is no value or it is not a date", () => {
    expect(formatDateTimeVN(null)).toBe("-");
    expect(formatDateTimeVN(undefined)).toBe("-");
    expect(formatDateTimeVN("")).toBe("-");
    expect(formatDateTimeVN("not a date")).toBe("-");
  });

  it("gives the same text whatever the time zone of the machine", () => {
    // Node reads TZ again when it is assigned, so this moves the "browser" to other zones
    const before = process.env.TZ;
    try {
      for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
        process.env.TZ = zone;
        expect(formatDateTimeVN("2026-11-07T07:03:18Z")).toBe(
          "07/11/2026 14:03",
        );
        expect(formatDateTimeVN("2026-09-24T17:30:00Z")).toBe(
          "25/09/2026 00:30",
        );
      }
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });

  it("gives the same date as formatDateVN", () => {
    const iso = "2026-09-24T17:30:00Z";
    expect(formatDateTimeVN(iso).startsWith(formatDateVN(iso))).toBe(true);
  });
});
