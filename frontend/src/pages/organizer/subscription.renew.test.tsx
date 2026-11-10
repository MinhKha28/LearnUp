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
  getRenewalQuoteAPI,
  renewSubscriptionAPI,
} from "@/services/subscription.service";
import SubscriptionRenew from "./subscription.renew";

vi.mock("@/services/subscription.service", () => ({
  getRenewalQuoteAPI: vi.fn(),
  renewSubscriptionAPI: vi.fn(),
}));

const quote = {
  planName: "Standard",
  planOffered: true,
  currentStatus: "Active",
  price: 1_000_000,
  durationDays: 30,
  maxLearners: 10,
  maxInstructors: 2,
  maxCourseChains: 5,
  maxStorageBytes: 1024 ** 3,
  startsAt: "2026-12-01T00:00:00.000Z",
  expiresAt: "2026-12-31T00:00:00.000Z",
  scheduledRenewal: null,
  usageAvailable: true,
  exceededLimits: [],
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
  vi.mocked(getRenewalQuoteAPI).mockReset();
  vi.mocked(renewSubscriptionAPI).mockReset();
  vi.mocked(getRenewalQuoteAPI).mockResolvedValue({
    data: quote,
  } as never);
});
afterEach(cleanup);

const payWith = async (response: unknown) => {
  vi.mocked(renewSubscriptionAPI).mockResolvedValue(response as never);
  render(
    <MemoryRouter>
      <App>
        <SubscriptionRenew />
      </App>
    </MemoryRouter>,
  );
  const button = await screen.findByRole("button", { name: /mock payment/i });
  fireEvent.click(button);
  await screen.findByRole("alert");
  return () => screen.getByRole("button", { name: /mock payment/i });
};

describe("UC10.1 renewal page after a payment error", () => {
  it("charged but not applied: says not to pay again and locks the payment button", async () => {
    const button = await payWith({
      error: { code: "RENEWAL_NOT_APPLIED" },
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Do not pay again");
    expect(alert.textContent).not.toContain("try again");
    expect((button() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button());
    expect(renewSubscriptionAPI).toHaveBeenCalledTimes(1);
    expect(getRenewalQuoteAPI).toHaveBeenCalledTimes(1);
  });

  it("a declined payment can still be retried", async () => {
    const button = await payWith({ data: { paymentStatus: "Failed" } });
    expect(screen.getByRole("alert").textContent).toContain("You can try again");
    expect((button() as HTMLButtonElement).disabled).toBe(false);
  });
});
