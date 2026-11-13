// @vitest-environment jsdom
import { App } from "antd";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMyEnrollments } from "@/services/learning.service";
import { ApiError } from "@/types/api.types";
import type { MyEnrollmentsPage } from "@/types/learning.types";
import MyCourses from "./my.courses";

vi.mock("@/services/learning.service", () => ({
  fetchMyEnrollments: vi.fn(),
  withdrawOptionalCourse: vi.fn(),
}));
vi.mock("@/components/learner/course.cover", () => ({ CourseCover: () => null }));

const fetchPage = vi.mocked(fetchMyEnrollments);
const page = (name?: string, current = 1): MyEnrollmentsPage => ({
  items: name ? [{
    enrollmentId: name, courseId: name, enrollmentType: "Required", status: "NotStarted",
    dueAt: null, dueTimezone: null, requiredMaterials: { completed: 0, total: 0 },
    course: { name, coverFileId: null, versionNumber: 1 },
  }] : [],
  meta: { current, pageSize: 20, pages: name ? 2 : 0, total: name ? 21 : 0 },
});

const renderCourses = (entries: string[]) => {
  const router = createMemoryRouter([
    { path: "/", element: <App><MyCourses /></App> },
  ], { initialEntries: entries, future: { v7_relativeSplatPath: true } });
  render(<RouterProvider router={router} future={{ v7_startTransition: true }} />);
  return router;
};

const input = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Tìm theo tên khóa học" });

beforeEach(() => {
  fetchPage.mockReset();
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false, addListener: vi.fn(), removeListener: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("My Courses filters", () => {
  it("drops invalid URL filters before requesting courses and limits the keyword input", async () => {
    fetchPage.mockResolvedValue(page());
    const params = new URLSearchParams({ q: " 😀".trim().repeat(201), type: "Unknown", status: "Withdrawn" });
    renderCourses([`/?${params}`]);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1, {
      q: undefined, type: undefined, status: undefined,
    }, expect.any(AbortSignal));
    expect(input().value).toBe("");
    expect(input().maxLength).toBe(200);
    expect(screen.getByText("Tất cả loại khóa học")).toBeTruthy();
    expect(screen.getByText("Tất cả trạng thái")).toBeTruthy();
  });

  it("keeps a trimmed URL keyword of 200 Unicode code points", async () => {
    fetchPage.mockResolvedValue(page());
    const q = "😀".repeat(200);
    const params = new URLSearchParams({ q: ` ${q} `, type: "Optional", status: "Halted" });
    renderCourses([`/?${params}`]);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1, {
      q, type: "Optional", status: "Halted",
    }, expect.any(AbortSignal));
    expect(input().value).toBe(q);
  });

  it("restores URL filters and page on back and forward and debounces only text for 400 ms", async () => {
    fetchPage.mockImplementation(async (current) => page("Khóa học", current));
    vi.useFakeTimers();
    const router = renderCourses(["/?q=+an+toan+&type=Required&status=InProgress&page=2"]);
    await act(async () => {});
    expect(input().value).toBe("an toan");
    expect(fetchPage).toHaveBeenLastCalledWith(2, {
      q: "an toan", type: "Required", status: "InProgress",
    }, expect.any(AbortSignal));

    fireEvent.change(input(), { target: { value: "lập" } });
    await act(async () => { vi.advanceTimersByTime(399); });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    fireEvent.change(input(), { target: { value: "lập trình" } });
    await act(async () => { vi.advanceTimersByTime(399); });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(fetchPage).toHaveBeenLastCalledWith(1, {
      q: "lập trình", type: "Required", status: "InProgress",
    }, expect.any(AbortSignal));
    expect(new URLSearchParams(router.state.location.search).get("page")).toBe("1");

    await act(async () => { await router.navigate(-1); });
    expect(input().value).toBe("an toan");
    expect(fetchPage.mock.lastCall?.[0]).toBe(2);
    await act(async () => { await router.navigate(1); });
    expect(input().value).toBe("lập trình");
    expect(fetchPage.mock.lastCall?.[0]).toBe(1);
  });

  it("applies selects immediately, resets the page and preserves a pending keyword", async () => {
    fetchPage.mockImplementation(async (current) => page("Khóa học", current));
    vi.useFakeTimers();
    const router = renderCourses(["/?page=2"]);
    await act(async () => {});

    fireEvent.change(input(), { target: { value: "lập" } });
    await act(async () => { vi.advanceTimersByTime(200); });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Loại khóa học" }));
    fireEvent.click(screen.getByText("Tự chọn"));
    await act(async () => {});
    expect(fetchPage).toHaveBeenLastCalledWith(1, {
      q: undefined, type: "Optional", status: undefined,
    }, expect.any(AbortSignal));

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Trạng thái" }));
    fireEvent.click(screen.getByText("Quá hạn"));
    await act(async () => {});
    expect(fetchPage).toHaveBeenLastCalledWith(1, {
      q: undefined, type: "Optional", status: "Overdue",
    }, expect.any(AbortSignal));
    expect(new URLSearchParams(router.state.location.search).get("page")).toBe("1");

    await act(async () => { vi.advanceTimersByTime(200); });
    expect(fetchPage).toHaveBeenLastCalledWith(1, {
      q: "lập", type: "Optional", status: "Overdue",
    }, expect.any(AbortSignal));
  });

  it("keeps the list during a filter refetch and ignores an older response", async () => {
    let completeOld: (result: MyEnrollmentsPage) => void = () => {};
    let completeNew: (result: MyEnrollmentsPage) => void = () => {};
    fetchPage.mockImplementationOnce(async () => page("Danh sách hiện tại"))
      .mockImplementationOnce(() => new Promise((resolve) => { completeOld = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { completeNew = resolve; }));
    const router = renderCourses(["/?page=1"]);
    await screen.findByText("Danh sách hiện tại");

    await act(async () => { await router.navigate("/?q=cũ&page=1"); });
    expect(screen.getByText("Danh sách hiện tại")).toBeTruthy();
    expect(screen.getByLabelText("Đang tải khóa học")).toBeTruthy();
    await act(async () => { await router.navigate("/?q=mới&page=1"); });
    expect(fetchPage.mock.calls[1][2]?.aborted).toBe(true);

    await act(async () => { completeNew(page("Kết quả mới")); });
    await act(async () => { completeOld(page("Kết quả cũ")); });
    expect(screen.getByText("Kết quả mới")).toBeTruthy();
    expect(screen.queryByText("Kết quả cũ")).toBeNull();
  });

  it("clears all filters and shows the distinct unfiltered empty state", async () => {
    fetchPage.mockImplementation(async () => page());
    const router = renderCourses(["/?q=lap&type=Optional&status=Halted&page=2"]);
    await screen.findByText("Không tìm thấy khóa học phù hợp");
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    await screen.findByText("Bạn chưa có khóa học nào");
    expect(input().value).toBe("");
    expect(router.state.location.search).toBe("?page=1");
  });

  it("retries a 503 with the same keyword, type and status", async () => {
    fetchPage.mockRejectedValueOnce(new ApiError(503, "SERVICE_UNAVAILABLE", ""));
    fetchPage.mockResolvedValueOnce(page("Khóa học đã tải"));
    renderCourses(["/?q=lap&type=Optional&status=Completed&page=1"]);
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
    await screen.findByText("Khóa học đã tải");
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage.mock.calls[1].slice(0, 2)).toEqual(fetchPage.mock.calls[0].slice(0, 2));
    expect(input().value).toBe("lap");
  });
});
