// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LayoutOrganizer from "@/components/layout/layout.organizer";

vi.mock("@/components/context/app.context", () => ({
  useCurrentApp: () => ({ user: null }),
}));
vi.mock("@/components/notification/notification.bell", () => ({
  default: () => null,
}));
vi.mock("@/hooks/use.sign.out", () => ({ useSignOut: () => vi.fn() }));

const renderOrganizer = (path: string) =>
  render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/organizer" element={<LayoutOrganizer />}>
          <Route path="profile" element={<h1>Hồ sơ</h1>} />
          <Route path="profile/edit" element={<h1>Sửa hồ sơ</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Organizer profile topbar labels", () => {
  it.each([
    ["/organizer/profile", "Hồ sơ"],
    ["/organizer/profile/edit", "Sửa hồ sơ"],
  ])("matches the page heading at %s", (path, label) => {
    const { container } = renderOrganizer(path);

    expect(container.querySelector(".organizer-topbar-left strong")?.textContent).toBe(
      label,
    );
    expect(screen.getByRole("heading", { name: label })).toBeTruthy();
  });
});

it("uses the glossary role in the Organizer footer", () => {
  const { container } = render(
    <MemoryRouter
      initialEntries={["/organizer"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <LayoutOrganizer />
    </MemoryRouter>,
  );
  const footer = container.querySelector<HTMLElement>(".organizer-footer")!;

  expect(within(footer).getByText("Quản lý đào tạo")).toBeTruthy();
  expect(within(footer).queryByText("Quản lý tổ chức")).toBeNull();
});
