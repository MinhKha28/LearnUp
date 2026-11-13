// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AdminProfileEdit from "@/pages/admin/profile.edit";
import OrganizerProfileEdit from "@/pages/organizer/profile.edit";

const { profile } = vi.hoisted(() => ({
  profile: {
    fullName: "Nguyễn Văn An",
    email: "test@example.invalid",
    role: "Admin",
    organizationId: "organization",
    department: null as string | null,
  },
}));

vi.mock("@/hooks/use.my.profile", () => ({
  initialsOf: () => "NA",
  useMyProfile: () => ({ profile, loading: false, clearError: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([
  ["Admin", AdminProfileEdit, false],
  ["Organizer", OrganizerProfileEdit, true],
] as const)("renders the department only for an organization role (%s)", (role, Page, visible) => {
  profile.role = role;
  profile.department = visible ? "Đào tạo" : null;
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Page /></MemoryRouter>);

  expect(screen.getByRole("heading", { name: "Sửa hồ sơ" })).toBeTruthy();
  if (visible) {
    expect(screen.getByText("Đơn vị công tác (chỉ xem)")).toBeTruthy();
    expect(screen.getByDisplayValue("Đào tạo")).toBeTruthy();
    expect(screen.getByText("Do quản lý đào tạo quản lý.")).toBeTruthy();
  } else {
    expect(screen.queryByText("Đơn vị công tác (chỉ xem)")).toBeNull();
    expect(screen.queryByText("Do quản lý đào tạo quản lý.")).toBeNull();
  }
});
