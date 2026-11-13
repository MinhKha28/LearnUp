// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { getCurrentSubscriptionAPI } from "@/services/subscription.service";
import type { ISubscriptionOverview } from "@/types/subscription.types";
import Subscription from "./subscription";

vi.mock("@/services/subscription.service", () => ({ getCurrentSubscriptionAPI: vi.fn() }));

afterEach(cleanup);

it("derives the storage caption and bar from bytes even when the response includes a different percent", async () => {
  const usageItem = { used: 1, limit: 10, percent: 10, warning: false };
  const overview: ISubscriptionOverview = {
    organizationName: "Tổ chức kiểm tra",
    subscription: null,
    scheduledRenewal: null,
    usageWarningThresholdPercent: 80,
    graceDays: 7,
    organizerReadOnlyDays: 7,
    courseUsageAvailable: true,
    usage: {
      learners: usageItem,
      instructors: usageItem,
      courses: usageItem,
      storageBytes: { ...usageItem, used: 1_234_567, limit: 3_758_096_384 },
    },
  };
  vi.mocked(getCurrentSubscriptionAPI).mockResolvedValue({ statusCode: 200, message: "", data: overview });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Subscription /></MemoryRouter>);

  const storage = (await screen.findByText("Dung lượng lưu trữ")).closest<HTMLElement>(".sub-usage-card")!;
  expect(within(storage).getByText("Dưới 1%")).toBeTruthy();
  const bar = storage.querySelector<HTMLElement>(".sub-usage-bar span")!;
  expect(parseFloat(bar.style.width)).toBeCloseTo(0.03285);
  expect(screen.getAllByText("Đã dùng 10%")).toHaveLength(3);
});
