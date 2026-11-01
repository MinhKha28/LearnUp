// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchEnrollmentProgress } from "@/services/learning.service";
import { fetchLearnerAssessmentsAPI } from "@/services/assessment.service";
import type { EnrollmentProgress } from "@/types/learning.types";
import { ApiError } from "@/types/api.types";
import CourseProgress from "./course.progress";

vi.mock("@/services/learning.service", () => ({
  fetchEnrollmentProgress: vi.fn(),
}));
vi.mock("@/services/assessment.service", () => ({
  fetchLearnerAssessmentsAPI: vi.fn(),
}));
vi.mock("@/hooks/use.learning.refresh", () => ({
  useLearningRefresh: vi.fn(),
}));
const progress = vi.mocked(fetchEnrollmentProgress);
const assessments = vi.mocked(fetchLearnerAssessmentsAPI);
const fixture = (): EnrollmentProgress => ({
  enrollment: {
    id: "enrollment",
    courseId: "course",
    status: "InProgress",
    enrollmentType: "Required",
    dueAt: "2026-11-02T17:00:00Z",
    dueTimezone: "Asia/Ho_Chi_Minh",
    completedAt: null,
    completedLate: null,
  },
  materials: [
    {
      materialId: "m",
      lessonId: "lesson",
      title: "Đọc tài liệu an toàn",
      materialType: "Reading",
      required: true,
      done: false,
    },
  ],
  assessment: {
    state: "ok",
    items: [
      { kind: "quiz", assessmentId: "q", passed: false, peerReview: null },
      {
        kind: "assignment",
        assessmentId: "a",
        passed: true,
        peerReview: {
          status: "Pending",
          requiredCount: 2,
          completedCount: 1,
          done: false,
        },
      },
    ],
  },
  conditions: {
    state: "ok",
    met: 1,
    total: 4,
    missing: [
      { kind: "material", id: "m" },
      { kind: "quiz", id: "q" },
      { kind: "peerReview", id: "a" },
    ],
  },
});
const mount = () =>
  render(
    <MemoryRouter initialEntries={["/learner/courses/enrollment/progress"]}>
      <Routes>
        <Route
          path="/learner/courses/:enrollmentId/progress"
          element={<CourseProgress />}
        />
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.resetAllMocks();
  progress.mockResolvedValue(fixture());
  assessments.mockResolvedValue({
    data: {
      items: [
        { id: "q", title: "Kiểm tra an toàn" },
        { id: "a", title: "Bài thực hành" },
      ],
    },
  } as never);
});
afterEach(cleanup);
describe("UC28 real progress page", () => {
  it("shows counts, a complete missing list, joined names and due date without percentage", async () => {
    const { container } = mount();
    await screen.findByText("Điều kiện hoàn thành: 1/4 đã đạt");
    await screen.findByText("Đạt điểm yêu cầu: Kiểm tra an toàn");
    const missing = screen.getByRole("region", { name: "Điều kiện còn thiếu" });
    expect(within(missing).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(missing).getByText("Hoàn thành chấm chéo: Bài thực hành"),
    ).toBeTruthy();
    expect(
      within(missing).getByText("Đọc tài liệu an toàn").getAttribute("href"),
    ).toContain("/lessons/lesson");
    expect(
      screen.getByText("Hạn hoàn thành: Hết ngày 02/11/2026"),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("%");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(progress).toHaveBeenCalledWith(
      "enrollment",
      expect.any(AbortSignal),
    );
    expect(assessments).toHaveBeenCalledWith("course");
  });
  it("keeps materials when Assessment is unavailable and retries the endpoint", async () => {
    const degraded = fixture();
    degraded.assessment = { state: "unavailable" };
    degraded.conditions = {
      state: "unavailable",
      met: null,
      total: null,
      missing: [{ kind: "material", id: "m" }],
    };
    progress.mockResolvedValueOnce(degraded).mockResolvedValue(fixture());
    mount();
    await screen.findByText("Chưa tải được thông tin bài kiểm tra/bài tập");
    expect(
      screen.getByRole("region", { name: "Học liệu" }).textContent,
    ).toContain("Đọc tài liệu an toàn");
    expect(screen.queryByText(/Điều kiện hoàn thành:/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Điều kiện hoàn thành: 1/4 đã đạt");
    expect(progress).toHaveBeenCalledTimes(2);
  });
  it("Completed shows only stored summary and post-completion links, with no assessment list call", async () => {
    progress.mockResolvedValue({
      enrollment: {
        ...fixture().enrollment,
        status: "Completed",
        completedAt: "2026-11-03T00:00:00Z",
        completedLate: true,
      },
    });
    mount();
    await screen.findByText("Hoàn thành");
    expect(screen.getByText(/Ngày hoàn thành:/)).toBeTruthy();
    expect(screen.getByText("Hoàn thành sau hạn")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Xem chứng chỉ" }).getAttribute("href"),
    ).toBe("/learner/certificates");
    expect(
      screen
        .getByRole("link", { name: "Đánh giá Khóa học" })
        .getAttribute("href"),
    ).toBe("/learner/courses/enrollment/evaluation");
    expect(
      screen.queryByRole("region", { name: "Điều kiện còn thiếu" }),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Học liệu" })).toBeNull();
    expect(assessments).not.toHaveBeenCalled();
  });
  for (const [code, status, text] of [
    [
      "CONTENT_UNAVAILABLE",
      403,
      "Khóa học đang tạm dừng, bạn chưa thể truy cập nội dung",
    ],
    ["ENROLLMENT_NOT_FOUND", 404, "Không tìm thấy Khóa học"],
  ] as const) {
    it(`reuses curriculum error mapping for ${code}`, async () => {
      progress.mockRejectedValue(new ApiError(status, code, ""));
      mount();
      await screen.findByText(text);
      expect(assessments).not.toHaveBeenCalled();
    });
  }
  it("falls back to Vietnamese generic names if the assessment list fails", async () => {
    assessments.mockRejectedValue(new Error("unavailable"));
    mount();
    await screen.findByText("Đạt điểm yêu cầu: Bài kiểm tra");
    await waitFor(() => expect(assessments).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Hoàn thành chấm chéo: Bài tập")).toBeTruthy();
  });
});
