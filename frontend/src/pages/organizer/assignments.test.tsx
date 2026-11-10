// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { fetchAssignments } from "@/services/assignment.service";
import { ApiError } from "@/types/api.types";
import Assignments from "./assignments";

vi.mock("@/services/assignment.service", () => ({ fetchAssignments: vi.fn() }));
const load = vi.mocked(fetchAssignments);

beforeAll(() => {
  const computedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (element) => computedStyle(element);
  window.matchMedia = (media) => ({
    matches: false, media, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  });
});
afterEach(() => {
  cleanup();
  load.mockReset();
});

const empty = { page: 1, pageSize: 20, total: 0, items: [] };
function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="URL">{location.search}</output>
      <button onClick={() => navigate(-1)}>Quay lại</button>
    </>
  );
}
function show(query = "") {
  return render(
    <MemoryRouter initialEntries={["/organizer/assignments" + query]}>
      <Navigation />
      <Assignments />
    </MemoryRouter>,
  );
}

it("hydrates URL filters and applies a draft only on submit, resetting the page and preserving history", async () => {
  load.mockResolvedValue({ ...empty, total: 45 });
  show("?page=2&learner=An&status=Overdue&dueFrom=2026-11-01&dueTo=2026-11-03");
  const learner = screen.getByLabelText("Học viên") as HTMLInputElement;
  expect(learner.value).toBe("An");
  expect((screen.getByPlaceholderText("Từ ngày") as HTMLInputElement).value).toBe("01/11/2026");
  await waitFor(() => expect(load).toHaveBeenCalledWith(2, expect.objectContaining({
    learner: "An", status: "Overdue", dueFrom: "2026-11-01", dueTo: "2026-11-03",
  }), expect.any(AbortSignal)));
  fireEvent.change(learner, { target: { value: "  Hào " } });
  expect(load).toHaveBeenCalledTimes(1);
  fireEvent.submit(screen.getByRole("form", { name: "Bộ lọc phân công" }));
  await waitFor(() => expect(load).toHaveBeenLastCalledWith(1, expect.objectContaining({
    learner: "Hào", status: "Overdue", dueFrom: "2026-11-01", dueTo: "2026-11-03",
  }), expect.any(AbortSignal)));
  expect(screen.getByLabelText("URL").textContent).toContain("page=1&learner=H%C3%A0o");
  fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
  await waitFor(() => expect(load).toHaveBeenLastCalledWith(2, expect.objectContaining({ learner: "An" }), expect.any(AbortSignal)));
  expect((screen.getByLabelText("Học viên") as HTMLInputElement).value).toBe("An");
});

it("clears the URL and draft from the filtered empty state", async () => {
  load.mockResolvedValue(empty);
  show("?course=Fixture");
  await screen.findByText("Không có phân công phù hợp với bộ lọc");
  const buttons = screen.getAllByRole("button", { name: "Xóa bộ lọc" });
  fireEvent.click(buttons[1]);
  await screen.findByText("Chưa có phân công Khóa học nào");
  expect(screen.getByLabelText("URL").textContent).toBe("?page=1");
  expect((screen.getByLabelText("Khóa học") as HTMLInputElement).value).toBe("");
  expect(load).toHaveBeenLastCalledWith(1, expect.objectContaining({ course: undefined }), expect.any(AbortSignal));
});

it.each([
  [422, "SEARCH_TOO_BROAD", "Từ khóa quá rộng, hãy nhập cụ thể hơn", false],
  [503, "LEARNER_SEARCH_UNAVAILABLE", "Tạm thời không thể tìm Học viên. Vui lòng thử lại.", true],
  [503, "COURSE_SEARCH_UNAVAILABLE", "Tạm thời không thể tìm Khóa học. Vui lòng thử lại.", true],
  [400, "INVALID_DUE_DATE_RANGE", "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.", false],
  [400, "VALIDATION_FAILED", "Bộ lọc không hợp lệ. Vui lòng kiểm tra từ khóa, tình trạng và ngày.", false],
] as const)("shows the message and retry affordance for %s %s", async (status, code, message, retry) => {
  load.mockRejectedValue(new ApiError(status, code, ""));
  show("?learner=H%C3%A0o");
  await screen.findByText(message);
  expect(Boolean(screen.queryByRole("button", { name: "Thử lại" }))).toBe(retry);
});
