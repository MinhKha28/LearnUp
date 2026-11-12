// @vitest-environment jsdom
import { App } from "antd";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminOrganizationDetailAPI } from "@/services/organization.service";
import type { IAdminOrganizationDetail } from "@/types/organization.types";
import OrganizationDetail from "./organization.detail";

vi.mock("@/services/organization.service", () => ({ getAdminOrganizationDetailAPI: vi.fn() }));

const ABC_ID = "0199a000-0000-7000-8000-00000000a001";
const ETA_ID = "0199a000-0000-7000-8000-00000000e003";

const abc: IAdminOrganizationDetail = {
  id: ABC_ID,
  name: "Công ty ABC",
  taxCode: "0312345678",
  address: "12 Nguyễn Huệ, TP.HCM",
  contactPhone: "0281234567",
  contactEmail: "lienhe@abc.vn",
  logoUrl: null,
  timezone: "Asia/Ho_Chi_Minh",
  status: "Active",
  createdAt: "2026-09-01T03:00:00.000Z",
  organizer: {
    id: "u1",
    fullName: "Nguyễn Văn An",
    email: "an.nguyen@abc.vn",
    status: "Active",
    activatedAt: "2026-09-02T03:00:00.000Z",
    invitation: null,
  },
  plan: { id: "p1", name: "Premium" },
  subscription: {
    plan: { id: "p1", name: "Premium" },
    status: "Active",
    startsAt: "2026-09-02T03:00:00.000Z",
    expiresAt: "2027-09-02T03:00:00.000Z",
    graceEndsAt: null,
    readOnlyEndsAt: null,
    daysRemaining: 295,
  },
  paymentDueAt: null,
  usageWarningThresholdPercent: 80,
  usage: {
    courseUsageAvailable: true,
    learners: { used: 24, limit: 500, percent: 4.8, warning: false },
    instructors: { used: 23, limit: 30, percent: 76.7, warning: false },
    courses: { used: 15, limit: 50, percent: 30, warning: false },
    storageBytes: { used: 1024 ** 3, limit: 10 * 1024 ** 3, percent: 10, warning: false },
  },
  suspensions: [
    { id: "s2", startedAt: "2026-11-01T03:00:00.000Z", endedAt: null, reason: "Vi phạm điều khoản" },
    { id: "s1", startedAt: "2026-10-01T03:00:00.000Z", endedAt: "2026-10-05T03:00:00.000Z", reason: "Kiểm tra" },
  ],
  duplicateTaxCode: { count: 1, organizations: [{ id: ETA_ID, name: "Công ty Eta", status: "Cancelled" }] },
};

const eta: IAdminOrganizationDetail = {
  ...abc,
  id: ETA_ID,
  name: "Công ty Eta",
  status: "Cancelled",
  organizer: null,
  subscription: null,
  usage: null,
  suspensions: [],
  duplicateTaxCode: { count: 1, organizations: [{ id: ABC_ID, name: "Công ty ABC", status: "Active" }] },
};

const ok = (data: IAdminOrganizationDetail) => ({ statusCode: 200, data }) as never;
const fail = (statusCode: number) => ({ statusCode, message: "error" }) as never;

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const renderPage = (organizationId: string) =>
  render(
    <MemoryRouter
      initialEntries={[`/admin/organizations/${organizationId}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App>
        <Routes>
          <Route path="/admin/organizations/:organizationId" element={<OrganizationDetail />} />
          <Route path="/admin/organizations" element={<p>Danh sách tổ chức</p>} />
        </Routes>
      </App>
    </MemoryRouter>,
  );

describe("UC44.1 Admin organization detail page", () => {
  it("shows the organization, its Subscription, usage, Organizer and suspensions in Vietnamese", async () => {
    vi.mocked(getAdminOrganizationDetailAPI).mockResolvedValue(ok(abc));
    renderPage(ABC_ID);

    expect(await screen.findByRole("heading", { name: "Công ty ABC" })).toBeTruthy();
    expect(getAdminOrganizationDetailAPI).toHaveBeenCalledWith(ABC_ID);
    expect(screen.getByText("Chi tiết tổ chức · đăng ký ngày 01/09/2026")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Thông tin tổ chức" })).toBeTruthy();
    expect(screen.getByText("0312345678")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Gói dịch vụ và mức dùng" })).toBeTruthy();
    expect(screen.getByText("Còn 295 ngày")).toBeTruthy();
    expect(screen.getByText("24 / 500")).toBeTruthy();
    expect(screen.getByText("Đã dùng 4,8%")).toBeTruthy();
    expect(screen.getByText("1 GB / 10 GB")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Quản lý đào tạo hiện tại" })).toBeTruthy();
    expect(screen.getByText("Nguyễn Văn An")).toBeTruthy();
    expect(screen.getByText("Kích hoạt ngày 02/09/2026")).toBeTruthy();
    expect(screen.getByText("Đã gỡ")).toBeTruthy();
    expect(screen.getByText("Đang hiệu lực")).toBeTruthy();
    expect(screen.getByText("Mã số thuế 0312345678 cũng được 1 tổ chức khác sử dụng")).toBeTruthy();
  });

  it("keeps Replace Organizer (UC44.5) and Suspend (UC44.3) disabled", async () => {
    vi.mocked(getAdminOrganizationDetailAPI).mockResolvedValue(ok(abc));
    renderPage(ABC_ID);
    await screen.findByRole("heading", { name: "Công ty ABC" });

    expect((screen.getByRole("button", { name: "Thay quản lý đào tạo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Tạm khóa" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Thay quản lý đào tạo" }).title).toBe("Tính năng thay quản lý đào tạo chưa hoạt động.");
    expect(screen.getByRole("button", { name: "Tạm khóa" }).title).toBe("Tính năng tạm khóa tổ chức chưa hoạt động.");
  });

  it.each([400, 404])("answers %i as not found, with the way back to the list", async (statusCode) => {
    vi.mocked(getAdminOrganizationDetailAPI).mockResolvedValue(fail(statusCode));
    renderPage("not-an-id");

    expect(await screen.findByText("Không tìm thấy tổ chức.")).toBeTruthy();
    expect(screen.queryByText("Thử lại")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Về danh sách tổ chức" }));
    expect(await screen.findByText("Danh sách tổ chức")).toBeTruthy();
  });

  it("shows an error with Try again on another failure, and loads the record on retry", async () => {
    vi.mocked(getAdminOrganizationDetailAPI).mockResolvedValueOnce(fail(500)).mockResolvedValueOnce(ok(abc));
    renderPage(ABC_ID);

    expect(await screen.findByText("Chưa tải được tổ chức này.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("heading", { name: "Công ty ABC" })).toBeTruthy();
    expect(getAdminOrganizationDetailAPI).toHaveBeenCalledTimes(2);
  });

  it("treats a network error like another failure", async () => {
    vi.mocked(getAdminOrganizationDetailAPI).mockRejectedValue(new Error("Network Error"));
    renderPage(ABC_ID);

    expect(await screen.findByText("Chưa tải được tổ chức này.")).toBeTruthy();
  });

  it("PendingPayment: no Subscription, the payment deadline and no usage limits", async () => {
    vi.mocked(getAdminOrganizationDetailAPI).mockResolvedValue(
      ok({
        ...abc,
        status: "PendingPayment",
        subscription: null,
        usage: null,
        paymentDueAt: "2026-11-20T03:00:00.000Z",
        suspensions: [],
        duplicateTaxCode: { count: 0, organizations: [] },
      }),
    );
    renderPage(ABC_ID);
    await screen.findByRole("heading", { name: "Công ty ABC" });

    expect(screen.getAllByText("Chờ thanh toán")).toHaveLength(2);
    expect(screen.getByText("Gói đã đăng ký")).toBeTruthy();
    expect(screen.getByText("Thanh toán trước ngày 20/11/2026")).toBeTruthy();
    expect(screen.getByText("Chưa có gói dịch vụ hiện hành nên chưa áp dụng giới hạn sử dụng.")).toBeTruthy();
    expect(screen.getByText("Chưa có lượt tạm khóa nào.")).toBeTruthy();
    expect(screen.queryByText(/cũng được/)).toBeNull();
  });

  it("course-service down: Learners and Instructors still show, Courses and storage are not available", async () => {
    vi.mocked(getAdminOrganizationDetailAPI).mockResolvedValue(
      ok({
        ...abc,
        usage: {
          ...abc.usage!,
          courseUsageAvailable: false,
          courses: { used: null, limit: 50, percent: null, warning: false },
          storageBytes: { used: null, limit: 10 * 1024 ** 3, percent: null, warning: false },
        },
      }),
    );
    renderPage(ABC_ID);
    await screen.findByRole("heading", { name: "Công ty ABC" });

    expect(screen.getByText("24 / 500")).toBeTruthy();
    expect(screen.getAllByText("Chưa có số liệu")).toHaveLength(2);
    expect(
      screen.getByText("Hiện chưa lấy được số khóa học và dung lượng lưu trữ từ dịch vụ khóa học."),
    ).toBeTruthy();
  });

  it("opens the other organization with the same tax code, with a loading mark until it arrives", async () => {
    let resolveEta: (value: never) => void = () => {};
    vi.mocked(getAdminOrganizationDetailAPI)
      .mockResolvedValueOnce(ok(abc))
      .mockReturnValueOnce(new Promise((resolve) => (resolveEta = resolve)) as never);
    const { container } = renderPage(ABC_ID);
    await screen.findByRole("heading", { name: "Công ty ABC" });
    expect(container.querySelector(".ant-spin-spinning")).toBeNull();

    const duplicates = container.querySelector(".admin-duplicate-tax") as HTMLElement;
    expect(within(duplicates).getByText("Đã hủy")).toBeTruthy();
    fireEvent.click(within(duplicates).getByRole("link", { name: "Công ty Eta" }));

    expect(getAdminOrganizationDetailAPI).toHaveBeenLastCalledWith(ETA_ID);
    // antd Spin bật trạng thái quay qua debounce (delay 0), nên chờ một nhịp
    await waitFor(() => expect(container.querySelector(".ant-spin-spinning")).not.toBeNull());
    expect(screen.getByRole("heading", { name: "Công ty ABC" })).toBeTruthy();

    resolveEta(ok(eta));
    expect(await screen.findByRole("heading", { name: "Công ty Eta" })).toBeTruthy();
    await waitFor(() => expect(container.querySelector(".ant-spin-spinning")).toBeNull());
    expect(screen.getByText("Chưa có quản lý đào tạo hiện tại.")).toBeTruthy();
    expect(screen.getByText("Không có")).toBeTruthy();
  });
});
