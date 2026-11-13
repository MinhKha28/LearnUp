// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { fetchQuizAPI } from "@/services/assessment.service";
import { fetchCourseLessonDetailAPI, fetchLessonContentEditabilityAPI, fetchVideoUploadContextAPI } from "@/services/course.service";
import type { IQuizDetail } from "@/types/assessment.types";
import QuizDetail from "./course.builder.quiz.detail";
import QuestionCreate from "./course.builder.quiz.question.create";
import QuizCreate from "./course.builder.quiz.create";
import LessonContentEdit from "./course.builder.lesson.content.edit";
import VideoAdd from "./course.builder.material.video.add";
import MaterialDeleteBlocked from "./course.builder.material.delete.blocked";

vi.mock("@/services/axios.customize", () => ({ assessmentAxios: {}, courseAxios: {} }));
vi.mock("@/services/assessment.service", async (original) => ({
  ...await original<typeof import("@/services/assessment.service")>(),
  fetchQuizAPI: vi.fn(),
}));
vi.mock("@/services/course.service", () => ({
  fetchCourseLessonDetailAPI: vi.fn(),
  fetchLessonContentEditabilityAPI: vi.fn(),
  fetchVideoUploadContextAPI: vi.fn(),
  updateLessonContentAPI: vi.fn(),
}));
vi.mock("@/components/instructor/instructor.data", () => ({
  findInstructorCourse: () => ({ id: "c" }),
  findCourseStructure: () => ({}),
  findBuilderResource: () => ({ resource: { title: "Tài liệu", type: "reading", required: false } }),
}));

const course = { id: "c", name: "An toàn lao động", status: "Submitted" as const, locked: false };
const structure = { course, modules: [{ id: "m", title: "An toàn" }] };
const allowed = { allowed: true, reasons: [] };
const quiz = {
  id: "q", title: "Ôn tập", moduleId: null, placement: "COURSE", maxConsecutiveAttempts: 3,
  lockoutHours: 24, passingScore: 60, questions: [], lockReasons: [],
  permissions: {
    editQuestions: allowed, editTimeLimit: allowed, editAttemptRule: allowed, editPassingScore: allowed,
    editRequired: allowed, deleteQuiz: allowed, deleteLastQuestion: allowed,
  },
} satisfies Partial<IQuizDetail>;

function renderPage(path: string, pattern: string, page: ReactNode) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Outlet context={{ structure }} />}>
          <Route path={pattern} element={page} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function quizResponse(data: Partial<IQuizDetail>) {
  vi.mocked(fetchQuizAPI).mockResolvedValueOnce({
    statusCode: 200, message: "", data: data as IQuizDetail,
  });
}

afterEach(cleanup);

it.each([
  [quiz, "Cuối khóa học", "Tạm khóa trong 24 giờ sau 3 lượt làm liên tiếp."],
  [{ ...quiz, moduleId: "m", placement: "MODULE", lockoutHours: undefined }, "Sau các bài học của chương 1: An toàn", "Chưa xác định"],
] as const)("shows localized placement and attempt settings", async (data, placement, attempt) => {
  quizResponse(data);
  renderPage("/quizzes/q", "/quizzes/:quizId", <QuizDetail />);
  expect(await screen.findAllByText(placement)).toHaveLength(2);
  expect(screen.getByText(attempt)).toBeTruthy();
});

it("uses the Vietnamese fallback for a quiz load error", async () => {
  vi.mocked(fetchQuizAPI).mockResolvedValueOnce({ statusCode: 500, message: "Server error" });
  renderPage("/quizzes/q", "/quizzes/:quizId", <QuizDetail />);
  expect(await screen.findByText("Không thể tải bài trắc nghiệm.")).toBeTruthy();
});

it("localizes the question form and its answer controls", async () => {
  quizResponse(quiz);
  renderPage("/quizzes/q/questions/new", "/quizzes/:quizId/questions/new", <QuestionCreate />);
  expect(await screen.findByText("Xây dựng khóa học / Bài trắc nghiệm / Ôn tập / Thêm câu hỏi")).toBeTruthy();
  fireEvent.click(screen.getByText("Nhiều đáp án đúng"));
  expect(screen.getByText("Các đáp án (chọn tất cả đáp án đúng)")).toBeTruthy();
  expect(screen.getByLabelText("Đáp án A đúng")).toBeTruthy();
  expect(screen.getByLabelText("Xóa đáp án A")).toBeTruthy();
});

it("labels the course status when quiz creation is blocked", () => {
  renderPage("/quizzes/new", "/quizzes/new", <QuizCreate />);
  expect(screen.getByText("Khóa học đang ở trạng thái Chờ phê duyệt nên không thể thêm bài trắc nghiệm.")).toBeTruthy();
});

it("labels an optional reading on the blocked deletion page", () => {
  renderPage("/c/l/r", "/:courseId/:lessonId/:materialId", <MaterialDeleteBlocked />);
  expect(screen.getByText(/Không bắt buộc • Tài liệu đọc/)).toBeTruthy();
});

it("uses a Vietnamese heading for the lesson duration note", async () => {
  const lesson = { id: "l", title: "Giới thiệu", content: "Nội dung", position: 1, required: true, disabledAt: null };
  vi.mocked(fetchCourseLessonDetailAPI).mockResolvedValueOnce({
    statusCode: 200, message: "", data: { course, module: { id: "m", title: "An toàn", position: 1 }, lesson, materials: [] },
  });
  vi.mocked(fetchLessonContentEditabilityAPI).mockResolvedValueOnce({
    statusCode: 200, message: "", data: { canEdit: true, reason: null },
  });
  renderPage("/c/l", "/:courseId/:lessonId", <LessonContentEdit />);
  expect(await screen.findByText("Thời lượng dự kiến")).toBeTruthy();
});

it("localizes the video upload duration and subscription", async () => {
  vi.mocked(fetchVideoUploadContextAPI).mockResolvedValueOnce({
    statusCode: 200, message: "",
    data: {
      courseName: "An toàn", lessonTitle: "Giới thiệu",
      maxVideoDurationMinutes: 45, maxVideoSizeBytes: "100", remainingStorageBytes: "1000", maxStorageBytes: "1000", usedStorageBytes: "0",
      subscriptionStatus: "Grace", locked: false, canUpload: true,
      allowedVideoMimeTypes: ["video/mp4"], blockReason: null,
    },
  });
  renderPage("/c/l", "/:courseId/:lessonId", <VideoAdd />);
  expect(await screen.findByText("45 phút")).toBeTruthy();
  expect(screen.getByText("Trong thời gian ân hạn")).toBeTruthy();
});
