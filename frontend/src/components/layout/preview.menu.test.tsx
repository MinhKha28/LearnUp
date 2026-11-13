// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LayoutAdmin from "./layout.admin";
import LayoutInstructor from "./layout.instructor";
import LayoutLearner from "./layout.learner";
import LayoutOrganizer from "./layout.organizer";

vi.mock("@/components/context/app.context", () => ({ useCurrentApp: () => ({ user: null }) }));
vi.mock("@/components/notification/notification.bell", () => ({ default: () => null }));
vi.mock("@/hooks/use.sign.out", () => ({ useSignOut: () => vi.fn() }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each([
  {
    Layout: LayoutAdmin,
    path: "/admin/plans",
    realItem: "Gói dịch vụ",
    hidden: ["Tổng quan nền tảng", "Cấu hình", "Thống kê nền tảng", "Báo cáo chuyển cấp", "Tổ chức bị tạm khóa"],
  },
  {
    Layout: LayoutOrganizer,
    path: "/organizer/learners",
    realItem: "Học viên",
    hidden: ["Tổng quan", "Báo cáo", "Đánh giá", "Báo cáo nội dung", "Lịch sử vi phạm"],
  },
  {
    Layout: LayoutInstructor,
    path: "/instructor/courses",
    realItem: "Khóa học của tôi",
    hidden: ["Tổng quan", "Theo dõi học tập", "Đánh giá khóa học"],
  },
  {
    Layout: LayoutLearner,
    path: "/learner/courses",
    realItem: "Khóa học của tôi",
    hidden: ["Tổng quan", "Báo cáo của tôi"],
  },
])("preview-off menu at $path", ({ Layout, path, realItem, hidden }) => {
  it("renders real navigation without sample items or sample badges", () => {
    const { container } = render(
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout />
      </MemoryRouter>,
    );
    const items = screen.getAllByRole("menuitem");
    expect(items.some((item) => item.textContent?.trim() === realItem)).toBe(true);
    for (const text of hidden) {
      expect(items.some((item) => item.textContent?.trim().startsWith(text))).toBe(false);
    }
    expect(container.querySelector(".ant-menu .ant-badge-count")).toBeNull();
    expect(screen.queryByText("Dữ liệu minh họa")).toBeNull();
  });
});
