// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { fetchCatalog, fetchCourseIntroduction } from "@/services/catalog.service";
import { fetchEnrolledCourseLinks } from "@/services/learning.service";
import Catalog from "./catalog";
import CourseOverview from "./course.overview";

vi.mock("@/services/catalog.service");
vi.mock("@/services/learning.service");
vi.mock("@/services/axios.customize", () => ({ default: {}, assessmentAxios: {} }));

const catalog = vi.mocked(fetchCatalog);
const course = {
  id: "course",
  name: "Đào tạo",
  shortDescription: null,
  trainingObjectives: null,
  coverFileId: null,
  expectedCompletionDays: 7,
  estimatedDurationMinutes: null,
};
const pageResult = (current = 1, total = 13) => ({
  items: total ? [course] : [],
  meta: { current, total, pageSize: 12, pages: Math.ceil(total / 12) },
});

const Location = () => <output data-testid="query">{useLocation().search}</output>;
const query = () => screen.getByTestId("query").textContent;
const clearButton = () => screen.queryByRole("button", { name: "Xóa tìm kiếm" });
const input = () => screen.getByRole("textbox", { name: "Tìm kiếm Khóa học" }) as HTMLInputElement;
const renderCatalog = (search = "") => render(
  <MemoryRouter initialEntries={["/learner/catalog" + search]}>
    <Location />
    <Routes>
      <Route path="/learner/catalog" element={<Catalog />} />
      <Route path="/learner/catalog/:courseId" element={<CourseOverview />} />
    </Routes>
  </MemoryRouter>,
);

beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() });
  window.scrollTo = vi.fn();
});
beforeEach(() => {
  catalog.mockReset().mockImplementation(async (page) => pageResult(page));
  vi.mocked(fetchEnrolledCourseLinks).mockResolvedValue([]);
  vi.mocked(fetchCourseIntroduction).mockReturnValue(new Promise(() => {}));
});
afterEach(cleanup);

it("submits only when requested, resets the page, preserves q through pagination and detail return, and clears", async () => {
  renderCatalog("?page=2");
  await screen.findByRole("link", { name: course.name });
  expect(clearButton()).toBeNull();
  fireEvent.change(input(), { target: { value: "  Đào   tạo  " } });
  expect(clearButton()).toBeTruthy();
  expect(query()).toBe("?page=2");
  expect(catalog).toHaveBeenLastCalledWith(2, expect.any(AbortSignal), undefined);

  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm", exact: true }));
  expect(new URLSearchParams(query() ?? "").get("q")).toBe("Đào tạo");
  expect(new URLSearchParams(query() ?? "").get("page")).toBe("1");
  await screen.findByRole("link", { name: course.name });
  fireEvent.click(screen.getByTitle("2"));
  expect(new URLSearchParams(query() ?? "").get("page")).toBe("2");
  await waitFor(() => expect(catalog).toHaveBeenLastCalledWith(2, expect.any(AbortSignal), "Đào tạo"));
  fireEvent.click(await screen.findByRole("link", { name: course.name }));
  fireEvent.click(await screen.findByRole("button", { name: /Danh mục Khóa học/ }));
  expect(new URLSearchParams(query() ?? "").get("q")).toBe("Đào tạo");
  expect(new URLSearchParams(query() ?? "").get("page")).toBe("2");
  expect(input().value).toBe("Đào tạo");

  fireEvent.change(input(), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
  expect(query()).toBe("?page=1");
  expect(input().value).toBe("");
  expect(clearButton()).toBeNull();
  await waitFor(() => expect(catalog).toHaveBeenLastCalledWith(1, expect.any(AbortSignal), undefined));
});

it("keeps the form visible while loading and distinguishes zero matches from an empty catalog", async () => {
  catalog.mockImplementation((page, _signal, keyword) =>
    keyword === "đang tải" ? new Promise(() => {}) : Promise.resolve(pageResult(page, 0)),
  );
  renderCatalog();
  await screen.findByText("Hiện chưa có Khóa học nào để tự đăng ký");
  fireEvent.change(input(), { target: { value: "không khớp" } });
  // A browser's implicit Enter submission triggers the same form submit event.
  fireEvent.submit(screen.getByRole("search"));
  await screen.findByText("Không tìm thấy Khóa học nào phù hợp với từ khóa này");
  expect(screen.queryByText(/Tìm thấy .* Khóa học/)).toBeNull();
  fireEvent.change(input(), { target: { value: "đang tải" } });
  fireEvent.submit(screen.getByRole("search"));
  expect(input().value).toBe("đang tải");
  expect(screen.queryByText("Không tìm thấy Khóa học nào phù hợp với từ khóa này")).toBeNull();
});

it("announces the localized API total above the grid only for an active search", async () => {
  catalog.mockImplementation(async (page) => pageResult(page, 12345));
  const { container } = renderCatalog();
  await screen.findByRole("link", { name: course.name });
  expect(screen.queryByText(/Tìm thấy .* Khóa học/)).toBeNull();
  const liveRegion = container.querySelector('[aria-live="polite"]');

  fireEvent.change(input(), { target: { value: "dao tao" } });
  fireEvent.submit(screen.getByRole("search"));
  const count = await screen.findByText("Tìm thấy 12.345 Khóa học");
  expect(count).toBe(liveRegion);
  expect(count.nextElementSibling?.classList.contains("learner-catalog-grid")).toBe(true);
  expect(screen.getAllByRole("article")).toHaveLength(1);
});

it("uses the catalog grid and cover structure for 12 initial placeholders and the previous page count on reload", async () => {
  let complete: (result: ReturnType<typeof pageResult>) => void = () => {};
  catalog.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
  renderCatalog();
  const initial = screen.getByRole("status", { name: "Đang tải" });
  expect(initial.classList.contains("learner-catalog-grid")).toBe(true);
  expect(within(initial).getAllByRole("article", { hidden: true })).toHaveLength(12);
  expect(initial.querySelectorAll(".learner-catalog-card > .course-cover.course-cover-lg")).toHaveLength(12);
  expect(initial.querySelectorAll(".learner-catalog-card-meta")).toHaveLength(12);
  complete(pageResult());
  const realCard = (await screen.findByRole("link", { name: course.name })).closest("article");
  expect(realCard?.parentElement?.className).toBe(initial.className);
  expect(realCard?.querySelector(".course-cover.course-cover-lg")).toBeTruthy();

  catalog.mockReturnValueOnce(new Promise(() => {}));
  fireEvent.change(input(), { target: { value: "dao tao" } });
  fireEvent.submit(screen.getByRole("search"));
  const next = screen.getByRole("status", { name: "Đang tải" });
  expect(within(next).getAllByRole("article", { hidden: true })).toHaveLength(1);
});
