import { describe, expect, it } from "vitest";

import { ENROLLMENT_STATUS_LABELS, formatDuration, formatMinutes } from "@/utils/learner.labels";

describe("formatDuration", () => {
  it("null là chưa có", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("dưới 60 giây hiện theo giây", () => {
    expect(formatDuration(0)).toBe("0 giây");
    expect(formatDuration(45)).toBe("45 giây");
    expect(formatDuration(59)).toBe("59 giây");
  });

  it("từ 60 giây hiện theo phút, làm tròn xuống", () => {
    expect(formatDuration(60)).toBe("1 phút");
    expect(formatDuration(119)).toBe("1 phút");
    expect(formatDuration(3599)).toBe("59 phút");
  });

  it("từ 1 giờ hiện giờ và phút", () => {
    expect(formatDuration(3600)).toBe("1 giờ");
    expect(formatDuration(3900)).toBe("1 giờ 5 phút");
    expect(formatDuration(7384)).toBe("2 giờ 3 phút");
  });

  it("giá trị không hợp lệ hiện như chưa có", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
  });
});

describe("formatMinutes", () => {
  it("null là chưa có (D12)", () => {
    expect(formatMinutes(null)).toBe("—");
  });

  it("cùng kiểu chữ với formatDuration", () => {
    expect(formatMinutes(0)).toBe("0 phút");
    expect(formatMinutes(45)).toBe("45 phút");
    expect(formatMinutes(60)).toBe("1 giờ");
    expect(formatMinutes(150)).toBe("2 giờ 30 phút");
  });
});

describe("ENROLLMENT_STATUS_LABELS", () => {
  it("có nhãn cho cả Withdrawn", () => {
    expect(ENROLLMENT_STATUS_LABELS.Withdrawn.label).toBe("Đã rút");
    expect(ENROLLMENT_STATUS_LABELS.Overdue).toEqual({ label: "Quá hạn", tone: "error" });
  });
});
