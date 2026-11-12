import { describe, expect, it } from "vitest";
import { subscriptionUsage } from "./subscription.usage";

describe("subscription usage", () => {
  it("shows positive storage usage below one percent", () => {
    const usage = subscriptionUsage(1.2 * 1024 ** 2, 3.5 * 1024 ** 3, 80);
    expect(usage.label).toBe("Dưới 1%");
    expect(usage.barWidth).toBeCloseTo(0.03348);
  });

  it.each([
    [1, 10, "10%", 10, "ok"],
    [1, 8, "13%", 12.5, "ok"],
    [8, 10, "80%", 80, "warning"],
    [0, 10, "0%", 0, "ok"],
    [12, 10, "120%", 100, "full"],
  ])("formats %s of %s as %s", (used, limit, label, barWidth, level) => {
    expect(subscriptionUsage(used, limit, 80)).toEqual({ label, barWidth, level });
  });

  it.each([0, undefined, null])("omits the label for limit %s", (limit) => {
    expect(subscriptionUsage(1, limit, 80)).toEqual({ label: null, barWidth: 0, level: "ok" });
  });
});
