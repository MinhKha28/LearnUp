// @vitest-environment jsdom
import { App } from "antd";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAuditLogsAPI } from "@/services/audit.service";
import AdminAuditLogs from "./admin/audit.logs";
import OrganizerAuditLogs from "./organizer/audit.logs";

vi.mock("@/services/audit.service", () => ({ fetchAuditLogsAPI: vi.fn() }));

const entry = {
  id: "1",
  organizationId: "0199a000-0000-7000-8000-0a0000000001",
  actorUserId: "0199a000-0000-7000-8000-0b00000000aa",
  actorRole: "ADMIN",
  actionType: "INSTRUCTOR_REACTIVATED",
  targetResourceType: "User",
  targetResourceId: "0199a000-0000-7000-8000-0c00000000bb",
  details: null,
  createdAt: "2026-11-02T03:04:30.000Z",
};

beforeEach(() => {
  vi.mocked(fetchAuditLogsAPI).mockResolvedValue({
    success: true,
    data: { items: [entry], page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true },
  } as never);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = (page: JSX.Element) =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App>{page}</App>
    </MemoryRouter>,
  );

describe("the two pages of the audit trail", () => {
  it("UC50: the Organizer page is the audit trail of the own Organization, with no Organization column", async () => {
    renderPage(<OrganizerAuditLogs />);
    expect(screen.getByRole("heading", { name: "Nhật ký tổ chức" })).toBeTruthy();
    expect(screen.getByText("Các hành động đã được ghi nhận trong tổ chức của bạn.")).toBeTruthy();
    await screen.findByText("Kích hoạt lại tài khoản giảng viên");
    expect(screen.queryByText("Tổ chức")).toBeNull();
  });

  it("UC51: the Admin page is the audit trail of the platform, with the Organization of each action", async () => {
    renderPage(<AdminAuditLogs />);
    expect(screen.getByRole("heading", { name: "Nhật ký nền tảng" })).toBeTruthy();
    expect(screen.getByText("Các hành động ở cấp nền tảng và các hành động tác động lên tổ chức.")).toBeTruthy();
    await screen.findByText("Kích hoạt lại tài khoản giảng viên");
    expect(screen.getByText("Tổ chức")).toBeTruthy();
  });
});
