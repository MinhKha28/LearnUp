// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ComponentType } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { getMyProfileAPI } = vi.hoisted(() => ({ getMyProfileAPI: vi.fn() }));

vi.mock("@/services/axios.customize", () => ({ tenantAxios: {}, default: {} }));
vi.mock("@/components/context/app.context", () => ({
  useCurrentApp: () => ({ user: null, setUser: vi.fn() }),
}));
vi.mock("@/services/profile.service", () => ({
  getMyProfileAPI,
  removeAvatarAPI: vi.fn(),
  updateMyProfileAPI: vi.fn(),
  uploadAvatarAPI: vi.fn(),
  withProfile: vi.fn(),
}));

import AdminProfile from "@/pages/admin/profile";
import InstructorProfile from "@/pages/instructor/profile";
import LearnerProfile from "@/pages/learner/profile";
import OrganizerProfile from "@/pages/organizer/profile";

beforeAll(() => {
  const computedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (element) => computedStyle(element);
  window.matchMedia = (media) => ({
    matches: false,
    media,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
});

afterEach(() => {
  cleanup();
  getMyProfileAPI.mockReset();
});

const pages: [string, ComponentType][] = [
  ["Admin", AdminProfile],
  ["Organizer", OrganizerProfile],
  ["Learner", LearnerProfile],
  ["Instructor", InstructorProfile],
];

describe("UC09 read-only profile pages", () => {
  it.each(pages)("the %s profile explains an account that is not found", async (_role, Page) => {
    getMyProfileAPI.mockResolvedValue({ statusCode: 404, error: { code: "ACCOUNT_NOT_FOUND" } });
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Không tìm thấy tài khoản của bạn. Hãy đăng nhập lại.");
  });

  it.each(pages)("the %s profile shows no alert when the profile loads", async (_role, Page) => {
    getMyProfileAPI.mockResolvedValue({
      statusCode: 200,
      data: {
        id: "u-1",
        fullName: "Nguyễn Văn An",
        email: "an@example.com",
        role: "Learner",
        status: "Active",
        avatarUrl: null,
      },
    });
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    expect(await screen.findAllByText("Nguyễn Văn An")).not.toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
