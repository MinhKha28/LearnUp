import { describe, expect, it } from "vitest";
import { formatVnd } from "@/utils/helper";
import {
  blockedLimitLines,
  planLimitsLine,
  planPriceLine,
  upgradeBlockedMessage,
  upgradeErrorMessage,
  upgradeFormulaLine,
} from "./upgrade.view";

describe("UC10.2 upgrade view", () => {
  it("explains each limit that blocks a plan, storage in GB", () => {
    expect(
      blockedLimitLines([
        { limit: "learners", newLimit: 100, required: 120 },
        {
          limit: "storageBytes",
          newLimit: 50 * 1024 ** 3,
          required: 60 * 1024 ** 3,
        },
      ]),
    ).toEqual([
      "Số học viên: 100 thấp hơn mức cần 120",
      "Dung lượng lưu trữ: 50 GB thấp hơn mức cần 60 GB",
    ]);
  });

  const plan = {
    id: "p",
    name: "Big",
    price: 99_000_000,
    durationDays: 365,
    maxLearners: 100_000,
    maxInstructors: 10_000,
    maxCourseChains: 1_000,
    maxStorageBytes: 120 * 1024 ** 3,
    amount: 34_594_521,
    blockedBy: [],
  };

  it("shows limits with separators and the plan price with its duration", () => {
    expect(planLimitsLine(plan)).toBe(
      "100.000 học viên · 10.000 giảng viên · 1.000 khóa học · 120 GB",
    );
    expect(planPriceLine(plan)).toBe(`${formatVnd(99_000_000)} / 365 ngày`);
  });

  it("BR-19: shows how the amount is computed", () => {
    expect(
      upgradeFormulaLine(plan, { price: 30_000_000, durationDays: 365 }, 183),
    ).toBe(
      `(${formatVnd(99_000_000)} ÷ 365 ngày − ${formatVnd(30_000_000)} ÷ 365 ngày) × 183 ngày còn lại, làm tròn lên = ${formatVnd(34_594_521)}`,
    );
  });

  it("BR-19: fractional daily prices are not rounded, the amount comes from the backend", () => {
    expect(
      upgradeFormulaLine(
        { ...plan, price: 1_000_000, durationDays: 30, amount: 47_620 },
        { price: 200_000, durationDays: 7 },
        10,
      ),
    ).toBe(
      `(${formatVnd(1_000_000)} ÷ 30 ngày − ${formatVnd(200_000)} ÷ 7 ngày) × 10 ngày còn lại, làm tròn lên = ${formatVnd(47_620)}`,
    );
  });

  it("explains why an upgrade is not available", () => {
    expect(upgradeBlockedMessage(null)).toBeNull();
    expect(upgradeBlockedMessage("SUBSCRIPTION_NOT_ACTIVE")).toContain(
      "gia hạn",
    );
    expect(upgradeBlockedMessage("RENEWAL_ALREADY_SCHEDULED")).toContain(
      "sau khi kỳ đó bắt đầu",
    );
  });

  it("maps backend errors without raw codes", () => {
    expect(upgradeErrorMessage("UPGRADE_LIMITS_TOO_LOW")).toContain("thấp hơn");
    expect(upgradeErrorMessage("SUBSCRIPTION_NOT_ACTIVE")).toContain("gia hạn");
    expect(upgradeErrorMessage("NEW_CODE")).not.toContain("NEW_CODE");
    expect(upgradeErrorMessage("UPGRADE_NOT_APPLIED")).toContain(
      "Đừng thanh toán lần nữa",
    );
  });
});
