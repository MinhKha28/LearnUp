// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NotificationPage from "@/components/notification/notification.page";
import LayoutAdmin from "@/components/layout/layout.admin";
import LayoutOrganizer from "@/components/layout/layout.organizer";
import PlanForm from "@/pages/admin/plan.form";
import Profile from "@/pages/admin/profile";

vi.mock("@/components/context/app.context", () => ({ useCurrentApp: () => ({ user: null }) }));
vi.mock("@/components/notification/notification.bell", () => ({ default: () => null }));
vi.mock("@/hooks/use.sign.out", () => ({ useSignOut: () => vi.fn() }));
vi.mock("@/services/axios.customize", () => ({ tenantAxios: {} }));
vi.mock("@/services/notification.service", () => ({
  NOTIFICATIONS_CHANGED_EVENT: "learnup:notifications-changed",
  fetchNotifications: vi.fn(async () => ({ items: [], totalElements: 0 })),
  fetchUnreadCount: vi.fn(async () => ({ unreadCount: 0 })),
}));
vi.mock("@/hooks/use.my.profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use.my.profile")>();
  return {
    ...actual,
    useMyProfile: () => ({
      loading: false,
      profile: { fullName: "Nguyễn Văn An", email: "admin@example.invalid", role: "Admin", status: "Active" },
    }),
  };
});

const renderAdmin = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/admin" element={<LayoutAdmin />}>
          <Route path="notifications" element={<NotificationPage subtitle="Các cập nhật cần bạn chú ý trên nền tảng." />} />
          <Route path="plans/:id/edit" element={<PlanForm mode="edit" />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/edit" element={<h1>Sửa hồ sơ</h1>} />
          <Route path="reports" element={<h1>Báo cáo đã chuyển cấp xử lý</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Admin screenshot review wording", () => {
  it("shortens the reports menu label while preserving the breadcrumb", () => {
    const { container } = renderAdmin("/admin/reports");
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Báo cáo chuyển cấp")).toBeTruthy();
    expect(within(menu).queryByText("Báo cáo đã chuyển cấp xử lý")).toBeNull();
    expect(container.querySelector(".admin-topbar-left strong")?.textContent).toBe("Báo cáo đã chuyển cấp xử lý");
  });

  it("labels the preview and its disabled save action", () => {
    renderAdmin("/admin/plans/plan-1/edit");
    expect(screen.getByText("Tính năng sửa gói chưa hoạt động. Trang xem trước này dùng dữ liệu mẫu và không lưu thay đổi.")).toBeTruthy();
    const save = screen.getByRole<HTMLButtonElement>("button", { name: "Lưu thay đổi" });
    expect(save.disabled).toBe(true);
    expect(save.classList.contains("ant-btn-primary")).toBe(false);
  });

  it("shows the Admin notifications breadcrumb and subtitle", async () => {
    const { container } = renderAdmin("/admin/notifications");
    expect(container.querySelector(".admin-topbar-left strong")?.textContent).toBe("Thông báo");
    expect(await screen.findByText("Các cập nhật cần bạn chú ý trên nền tảng.")).toBeTruthy();
    expect(screen.queryByText("Cập nhật về khóa học, bài tập và bài chấm của bạn.")).toBeNull();
  });

  it("uses the platform role in the header and profile field", () => {
    const { container } = renderAdmin("/admin/profile");
    expect(container.querySelector(".admin-user small")?.textContent).toBe("Quản trị viên nền tảng");
    const role = screen.getByText("Vai trò").closest(".admin-detail-item")!;
    expect(within(role as HTMLElement).getByText("Quản trị viên nền tảng")).toBeTruthy();
  });

  it("matches the edit-profile breadcrumb to the page heading", () => {
    const { container } = renderAdmin("/admin/profile/edit");
    expect(container.querySelector(".admin-topbar-left strong")?.textContent).toBe("Sửa hồ sơ");
    expect(screen.getByRole("heading", { name: "Sửa hồ sơ" })).toBeTruthy();
  });
});

it("uses the glossary role in the Organizer footer", () => {
  const { container } = render(
    <MemoryRouter initialEntries={["/organizer"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LayoutOrganizer />
    </MemoryRouter>,
  );
  const footer = container.querySelector<HTMLElement>(".organizer-footer")!;
  expect(within(footer).getByText("Quản lý đào tạo")).toBeTruthy();
  expect(within(footer).queryByText("Quản lý tổ chức")).toBeNull();
});
