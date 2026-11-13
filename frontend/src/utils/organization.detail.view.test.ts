import { describe, expect, it } from "vitest";

import type { IAdminOrganizationDetail } from "@/types/organization.types";
import {
  formatBytes,
  organizationStatusViewVi,
  organizerStatusView,
  subscriptionStatusViewVi,
  usageLabel,
} from "./organization.detail.view";

type Organizer = NonNullable<IAdminOrganizationDetail["organizer"]>;

const organizer = (overrides: Partial<Organizer> = {}): Organizer => ({
  id: "o1",
  fullName: "Quách Minh Tú",
  email: "tu.quach@iota.vn",
  status: "Pending",
  activatedAt: null,
  invitation: null,
  ...overrides,
});

describe("UC44.1 organization detail view helpers", () => {
  it("BR-50: tells an active Organizer from one waiting on an open, an expired or no invitation", () => {
    expect(organizerStatusView(organizer({ status: "Active", activatedAt: "2026-10-01T00:00:00.000Z" }))).toEqual({
      label: "Đang hoạt động",
      tone: "success",
    });
    const invitation = { sentAt: "2026-11-01T00:00:00.000Z", expiresAt: "2026-11-08T00:00:00.000Z" };
    expect(organizerStatusView(organizer({ invitation: { ...invitation, expired: false } }))).toEqual({
      label: "Đang chờ nhận lời mời",
      tone: "warning",
    });
    expect(organizerStatusView(organizer({ invitation: { ...invitation, expired: true } }))).toEqual({
      label: "Lời mời đã hết hạn",
      tone: "error",
    });
    expect(organizerStatusView(organizer())).toEqual({ label: "Chờ kích hoạt", tone: "warning" });
  });

  it("labels every Organization and Subscription status in Vietnamese", () => {
    expect((["PendingPayment", "Active", "Suspended", "Cancelled"] as const).map((status) => organizationStatusViewVi(status).label)).toEqual([
      "Chờ thanh toán",
      "Đang hoạt động",
      "Tạm khóa",
      "Đã hủy",
    ]);
    expect((["Active", "Grace", "Suspended"] as const).map((status) => subscriptionStatusViewVi(status).label)).toEqual([
      "Đang hoạt động",
      "Trong thời gian ân hạn",
      "Tạm ngưng",
    ]);
  });

  it("provides neutral labels for missing and unknown statuses", () => {
    expect(organizationStatusViewVi()).toEqual({ label: "—", tone: "neutral" });
    expect(subscriptionStatusViewVi(null)).toEqual({ label: "—", tone: "neutral" });
  });

  it("shows bytes in GB from 1 GB up, and in MB or KB below", () => {
    expect(formatBytes(0)).toBe("0 GB");
    expect(formatBytes(1024 ** 3)).toBe("1 GB");
    expect(formatBytes(8.1 * 1024 ** 3)).toBe("8,1 GB");
    expect(formatBytes(512 * 1024 * 1024)).toBe("512 MB");
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("says the usage is not available when course-service did not answer", () => {
    expect(usageLabel({ used: 24, limit: 500, percent: 4.8, warning: false })).toBe("24 / 500");
    expect(usageLabel({ used: 1024 ** 3, limit: 10 * 1024 ** 3, percent: 10, warning: false }, formatBytes)).toBe(
      "1 GB / 10 GB",
    );
    expect(usageLabel({ used: null, limit: 30, percent: null, warning: false })).toBe("Chưa có số liệu");
  });
});
