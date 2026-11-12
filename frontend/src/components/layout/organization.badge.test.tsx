// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppProvider } from "@/components/context/app.context";
import LayoutInstructor from "@/components/layout/layout.instructor";
import LayoutLearner from "@/components/layout/layout.learner";
import LayoutOrganizer from "@/components/layout/layout.organizer";

const { fetchAccount, getProfile } = vi.hoisted(() => ({
  fetchAccount: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("@/services/identity.service", () => ({ fetchAccountAPI: fetchAccount }));
vi.mock("@/services/axios.customize", () => ({ tenantAxios: { get: getProfile } }));
vi.mock("@/components/notification/notification.bell", () => ({ default: () => null }));
vi.mock("@/hooks/use.sign.out", () => ({ useSignOut: () => vi.fn() }));

describe.each([
  { role: "LEARNER", Layout: LayoutLearner, path: "/learner", badge: ".learner-org-name" },
  { role: "ORGANIZER", Layout: LayoutOrganizer, path: "/organizer", badge: ".organizer-org-badge" },
  { role: "INSTRUCTOR", Layout: LayoutInstructor, path: "/instructor", badge: ".instructor-org-name" },
])("$role organization badge", ({ role, Layout, path, badge }) => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it.each(["Công ty Đào tạo An Việt", null])("uses the hydrated name %s", async (organizationName) => {
    localStorage.setItem("access_token", "test-session");
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })));
    const user = { id: "account", fullName: "Nguyễn Văn An", role };
    fetchAccount.mockResolvedValue({ data: user });
    getProfile.mockResolvedValue({ data: { ...user, organizationName } });

    const { container } = render(
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppProvider><Layout /></AppProvider>
      </MemoryRouter>,
    );

    await screen.findByText("Nguyễn Văn An");
    expect(getProfile).toHaveBeenCalledWith("/api/v1/users/me");
    expect(container.querySelector(badge)?.textContent ?? null).toBe(organizationName);
  });
});
