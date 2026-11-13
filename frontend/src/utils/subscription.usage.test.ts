import { describe, expect, it } from "vitest";
import { subscriptionUsage } from "./subscription.usage";

describe("subscription usage", () => {
  it("shows positive storage usage below one percent", () => {
    const usage = subscriptionUsage({ used: 1.2 * 1024 ** 2, limit: 3.5 * 1024 ** 3, warning: false });
    expect(usage.label).toBe("Dưới 1%");
    expect(usage.barWidth).toBeCloseTo(0.03348);
  });

  it.each([
    [1, 10, "10%", 10, "ok"],
    [1, 8, "13%", 12.5, "ok"],
    [8, 10, "80%", 80, "warning"],
    [159, 200, "80%", 79.5, "warning"],
    [159, 200, "80%", 79.5, "ok"],
    [199, 200, "Trên 99%", 99.5, "warning"],
    [200, 200, "100%", 100, "full"],
    [5, 0, "100%", 100, "full"],
    [0, 0, null, 0, "ok"],
    [0, 10, "0%", 0, "ok"],
    [12, 10, "120%", 100, "full"],
  ])("formats %s of %s as %s with bar %s and level %s", (used, limit, label, barWidth, level) => {
    expect(subscriptionUsage({ used, limit, warning: level === "warning" })).toEqual({ label, barWidth, level });
  });

  it.each([undefined, null])("omits the label for limit %s", (limit) => {
    expect(subscriptionUsage({ used: 1, limit, warning: false })).toEqual({ label: null, barWidth: 0, level: "ok" });
  });
});
