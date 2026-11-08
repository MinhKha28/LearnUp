// @vitest-environment jsdom
// UC30.2: the page of the result, in Vietnamese. jsdom is for this file only.
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/services/assessment.service";
import AssignmentResult from "./assignment.result";

vi.mock("@/services/axios.customize", () => ({ assessmentAxios: {}, default: {} }));
vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  fetchLearnerResultAPI: vi.fn(),
}));

const result = {
  submission: { id: "s1", submissionNumber: 2, submittedAt: "2026-11-02T08:30:00Z", fileName: null },
  assignment: { id: "a1", courseId: "c1", title: "Kế hoạch ứng phó", passingScore: 70 },
  finalScore: 82.5,
  passed: true,
  finalizationComment: "Làm tốt.",
  finalizedAt: "2026-11-03T09:00:00Z",
  criteria: [
    { id: "k1", name: "Nhận diện mối nguy", maxPoints: 25, averagePoints: 20 },
    { id: "k2", name: "Trình bày", maxPoints: 20, averagePoints: null },
  ],
  comments: [
    { source: "INSTRUCTOR", comment: "Rõ ràng.", completedAt: null },
    { source: "PEER", comment: "Cần thêm ví dụ.", completedAt: null },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/learner/courses/e1/assignments/a1/result"]}>
      <Routes>
        <Route path="/learner/courses/:enrollmentId/assignments/:assignmentId/result" element={<AssignmentResult />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.mocked(api.fetchLearnerResultAPI).mockResolvedValue({ data: result } as never);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the result of an Assignment", () => {
  it("is written in Vietnamese, with the dates in the Vietnamese format", async () => {
    renderPage();
    await screen.findByText("Kế hoạch ứng phó - kết quả");
    expect(screen.getByText("Điểm cuối cùng")).toBeTruthy();
    expect(screen.getByText("Đạt")).toBeTruthy();
    expect(screen.getByText("Điểm theo tiêu chí")).toBeTruthy();
    expect(screen.getByText("Giảng viên")).toBeTruthy();
    expect(screen.getByText("Người chấm chéo")).toBeTruthy();
    expect(screen.getByText("Ẩn")).toBeTruthy();
    expect(screen.getByText(/Lần nộp thứ 2, nộp lúc \d{1,2}:\d{2}:\d{2} \d{1,2}\/\d{1,2}\/2026/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Final score|Passed|Comments|Back to|pts/);
  });

  it("says why there is no result, in Vietnamese, and offers the way back", async () => {
    vi.mocked(api.fetchLearnerResultAPI).mockRejectedValue(new Error("network"));
    renderPage();
    await screen.findByText("Chưa có kết quả");
    expect(screen.getByText("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quay lại Bài trắc nghiệm và Bài tập" })).toBeTruthy();
  });
});
