// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  getUpgradeOptionsAPI,
  upgradeSubscriptionAPI,
} from "@/services/subscription.service";
import SubscriptionUpgrade from "./subscription.upgrade";

vi.mock("@/services/subscription.service", () => ({
  getUpgradeOptionsAPI: vi.fn(),
  upgradeSubscriptionAPI: vi.fn(),
}));

const options = {
  currentPlanName: "Standard",
  currentPrice: 1_000_000,
  currentDurationDays: 30,
  currentStatus: "Active",
  expiresAt: "2026-12-31T00:00:00.000Z",
  remainingDays: 10,
  blockedReason: null,
  usageAvailable: true,
  options: [
    {
      id: "big",
      name: "Big",
      price: 3_000_000,
      durationDays: 30,
      maxLearners: 100,
      maxInstructors: 10,
      maxCourseChains: 20,
      maxStorageBytes: 1024 ** 3,
      amount: 666_667,
      blockedBy: [],
    },
  ],
};

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList);
});

beforeEach(() => {
  vi.mocked(getUpgradeOptionsAPI).mockReset();
  vi.mocked(upgradeSubscriptionAPI).mockReset();
  vi.mocked(getUpgradeOptionsAPI).mockResolvedValue({
    data: options,
  } as never);
});
afterEach(cleanup);

const payWith = async (response: unknown) => {
  vi.mocked(upgradeSubscriptionAPI).mockResolvedValue(response as never);
  render(
    <MemoryRouter>
      <App>
        <SubscriptionUpgrade />
      </App>
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Big/ }));
  fireEvent.click(screen.getByRole("button", { name: /mock payment/i }));
  await screen.findByRole("alert");
  return () => screen.getByRole("button", { name: /mock payment/i });
};

describe("UC10.2 upgrade page after a payment error", () => {
  it("charged but not applied: says not to pay again and locks the payment button", async () => {
    const button = await payWith({
      error: { code: "UPGRADE_NOT_APPLIED" },
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Do not pay again");
    expect(alert.textContent).not.toContain("try again");
    expect((button() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button());
    expect(upgradeSubscriptionAPI).toHaveBeenCalledTimes(1);
    expect(getUpgradeOptionsAPI).toHaveBeenCalledTimes(1);
  });

  it("a declined payment can still be retried", async () => {
    const button = await payWith({ data: { paymentStatus: "Failed" } });
    expect(screen.getByRole("alert").textContent).toContain("You can try again");
    expect((button() as HTMLButtonElement).disabled).toBe(false);
  });
});
