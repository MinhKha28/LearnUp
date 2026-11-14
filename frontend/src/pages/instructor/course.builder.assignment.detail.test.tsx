// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { message } from "antd";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { fetchAssignmentAPI } from "@/services/assessment.service";
import CourseBuilderAssignmentDetail from "./course.builder.assignment.detail";

vi.mock("@/services/axios.customize", () => ({ assessmentAxios: {} }));

vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  fetchAssignmentAPI: vi.fn(),
}));

const assignment = {
  id: "a1",
  title: "Bài tập thực hành",
  expectedDurationMinutes: 45,
  passingScore: 60,
  maxConsecutiveAttempts: 3,
  lockoutHours: 2,
  peerReview: { enabled: true },
  rubric: [
    { id: "3", description: "Trình bày", maxPoints: 30 },
    { id: "2", position: 2, description: "Dẫn chứng", maxPoints: 10 },
    { id: "1", position: 1, description: "Nội dung", maxPoints: 60 },
    { id: "4", description: "Kết luận", maxPoints: 0 },
  ],
};

function openDetail(data?: typeof assignment) {
  vi.mocked(fetchAssignmentAPI).mockResolvedValueOnce({
    data,
    error: { code: "UNKNOWN", message: "An unexpected server error occurred" },
  } as unknown as Awaited<ReturnType<typeof fetchAssignmentAPI>>);
  return render(
    <MemoryRouter initialEntries={["/instructor/courses/c1/builder/assignments/a1"]}>
      <Routes>
        <Route element={<Outlet context={{ structure: { course: { id: "c1" } } }} />}>
          <Route
            path="/instructor/courses/:courseId/builder/assignments/:assignmentId"
            element={<CourseBuilderAssignmentDetail />}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("renders Vietnamese settings and numbers criteria in display order", async () => {
  const { container } = openDetail(assignment);
  await screen.findByRole("heading", { name: assignment.title });
  for (const text of ["45 phút", "Bật", "Tổng 100 điểm", "Tổng điểm", "60 điểm", "100 điểm"]) {
    expect(screen.getByText(text)).toBeTruthy();
  }
  expect(screen.getAllByText("2 giờ")).toHaveLength(2);
  expect(screen.getAllByText(/Chưa xác định/)).toHaveLength(5);
  const rows = Array.from(container.querySelectorAll<HTMLElement>(".builder-rubric-line"));
  expect(rows.slice(0, -1).map((row) => within(row).getByText(/^\d+\./).textContent)).toEqual([
    "1. Nội dung",
    "2. Dẫn chứng",
    "3. Trình bày",
    "4. Kết luận",
  ]);
});

it("shows Tắt when peer review is disabled", async () => {
  openDetail({ ...assignment, peerReview: { enabled: false } });
  expect(await screen.findByText("Tắt")).toBeTruthy();
});

it("shows the Vietnamese fallback for an unmapped load error", async () => {
  const error = vi.spyOn(message, "error").mockImplementation(vi.fn());
  openDetail();
  await waitFor(() => expect(error).toHaveBeenCalledWith("Không thể tải thông tin bài tập."));
});
