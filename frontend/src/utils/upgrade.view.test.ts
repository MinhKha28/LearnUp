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
      "Learners: 100 is below the 120 you need",
      "Storage: 50 GB is below the 60 GB you need",
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
      "100,000 Learners · 10,000 Instructors · 1,000 Courses · 120 GB",
    );
    expect(planPriceLine(plan)).toBe(`${formatVnd(99_000_000)} / 365 days`);
  });

  it("BR-19: shows how the amount is computed", () => {
    expect(
      upgradeFormulaLine(plan, { price: 30_000_000, durationDays: 365 }, 183),
    ).toBe(
      `(${formatVnd(271_233)} − ${formatVnd(82_192)}) per day × 183 remaining days = ${formatVnd(34_594_521)}`,
    );
  });

  it("explains why an upgrade is not available", () => {
    expect(upgradeBlockedMessage(null)).toBeNull();
    expect(upgradeBlockedMessage("SUBSCRIPTION_NOT_ACTIVE")).toContain("renew");
    expect(upgradeBlockedMessage("RENEWAL_ALREADY_SCHEDULED")).toContain(
      "after it starts",
    );
  });

  it("maps backend errors without raw codes", () => {
    expect(upgradeErrorMessage("UPGRADE_LIMITS_TOO_LOW")).toContain("below");
    expect(upgradeErrorMessage("SUBSCRIPTION_NOT_ACTIVE")).toContain("renew");
    expect(upgradeErrorMessage("NEW_CODE")).not.toContain("NEW_CODE");
  });
});
