import { describe, expect, it } from "vitest";

import { formatDueAt, formatGmtOffset } from "@/utils/due.format";

describe("formatDueAt", () => {
  it("00:00 theo múi giờ Organization là hết ngày hôm trước", () => {
    expect(formatDueAt("2026-10-11T17:00:00.000Z", "Asia/Ho_Chi_Minh")).toEqual({
      text: "Hết ngày 11/10/2026",
      isDeviceTime: false,
    });
    expect(formatDueAt("2026-09-29T17:00:00.000Z", "Asia/Ho_Chi_Minh").text).toBe("Hết ngày 29/09/2026");
  });

  it("lệch 00:00 thì hiện giờ và ngày", () => {
    expect(formatDueAt("2026-10-11T18:30:00.000Z", "Asia/Ho_Chi_Minh")).toEqual({
      text: "01:30 12/10/2026",
      isDeviceTime: false,
    });
  });

  it("đúng sau khi hết giờ mùa hè", () => {
    expect(formatDueAt("2026-11-02T05:00:00.000Z", "America/New_York").text).toBe("Hết ngày 01/11/2026");
  });

  it("múi giờ null thì dùng giờ máy", () => {
    expect(formatDueAt("2026-10-11T17:00:00.000Z", null)).toEqual({
      text: "00:00 12/10/2026 (giờ trên máy bạn, GMT+7)",
      isDeviceTime: true,
    });
  });

  it("múi giờ không hợp lệ giống múi giờ null, không ném lỗi", () => {
    expect(formatDueAt("2026-10-11T17:00:00.000Z", "Not/AZone")).toEqual(
      formatDueAt("2026-10-11T17:00:00.000Z", null),
    );
    expect(formatDueAt("2026-10-11T17:00:00.000Z", "").isDeviceTime).toBe(true);
  });

  it("ngày không hợp lệ không làm vỡ màn hình", () => {
    expect(formatDueAt("not-a-date", "Asia/Ho_Chi_Minh").text).toBe("—");
  });
});

describe("formatGmtOffset", () => {
  it("định dạng độ lệch", () => {
    expect(formatGmtOffset(420)).toBe("GMT+7");
    expect(formatGmtOffset(-300)).toBe("GMT-5");
    expect(formatGmtOffset(330)).toBe("GMT+5:30");
    expect(formatGmtOffset(-570)).toBe("GMT-9:30");
    expect(formatGmtOffset(0)).toBe("GMT+0");
    expect(formatGmtOffset(-0)).toBe("GMT+0");
  });
});
