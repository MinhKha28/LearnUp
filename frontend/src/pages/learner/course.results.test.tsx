// @vitest-environment jsdom
// UC28.1: the Learner reads the scores of the Course against the passing scores. jsdom is for this file only.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/services/axios.customize", () => ({
  assessmentAxios: {},
  default: {},
}));
vi.mock("@/services/learning.service", () => ({
  fetchAssessmentResults: vi.fn(),
}));

import { fetchAssessmentResults } from "@/services/learning.service";
import { ApiError } from "@/types/api.types";
import type {
  AssessmentResultItem,
  AssessmentResultsData,
} from "@/types/learning.types";
import CourseResults from "./course.results";

const load = vi.mocked(fetchAssessmentResults);

const quiz = (
  over: Partial<AssessmentResultItem> = {},
): AssessmentResultItem => ({
  assessmentId: "q-1",
  kind: "QUIZ",
  title: "Quiz an toàn",
  isRequired: true,
  disabled: false,
  passingScore: 70,
  status: "Completed",
  recordedScore: 85,
  passed: true,
  attemptCount: 2,
  lastActivityAt: "2026-11-05T10:00:00.000Z",
  quiz: {
    bestAttemptNumber: 2,
    attempts: [
      {
        attemptNumber: 1,
        score: 50,
        submittedAt: "2026-11-05T09:00:00.000Z",
        submissionKind: "Manual",
      },
      {
        attemptNumber: 2,
        score: 85,
        submittedAt: "2026-11-05T10:00:00.000Z",
        submissionKind: "TimedOut",
      },
    ],
  },
  assignment: null,
  ...over,
});
const assignment = (
  over: Partial<AssessmentResultItem> = {},
): AssessmentResultItem => ({
  ...quiz(),
  assessmentId: "a-1",
  kind: "ASSIGNMENT",
  title: "Bài luận",
  passingScore: 60,
  status: "AwaitingResult",
  recordedScore: null,
  passed: null,
  quiz: null,
  assignment: {
    latestSubmissionNumber: 1,
    gradingStatus: "AwaitingInstructor",
  },
  ...over,
});
const data = (
  items: AssessmentResultItem[],
  over: Partial<AssessmentResultsData> = {},
): AssessmentResultsData => ({
  enrollment: { id: "enr-1", courseId: "course-1", status: "InProgress" },
  state: "ok",
  summary: {
    total: items.length,
    passed: items.filter((i) => i.passed === true).length,
    notPassed: items.filter((i) => i.passed === false).length,
    pending: items.filter((i) => i.passed === null).length,
  },
  items,
  ...over,
});

let path = "";
const Where = () => {
  path = useLocation().pathname;
  return null;
};
const open = () =>
  render(
    <MemoryRouter initialEntries={["/learner/courses/enr-1/results"]}>
      <Routes>
        <Route
          path="/learner/courses/:enrollmentId/results"
          element={
            <>
              <CourseResults />
              <Where />
            </>
          }
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(() => {
  window.matchMedia ??= (() => ({
    matches: false,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as never;
});
beforeEach(() => {
  load.mockReset();
  load.mockResolvedValue(data([quiz(), assignment()]));
});
afterEach(cleanup);

describe("the results of a Course", () => {
  it("asks for the Enrollment in the address and shows each component with its score, passing score and comparison, in Vietnamese", async () => {
    open();
    expect(await screen.findByText("Quiz an toàn")).toBeTruthy();
    expect(load).toHaveBeenCalledWith("enr-1", expect.anything());
    expect(screen.getByText("Kết quả bài đánh giá")).toBeTruthy();
    expect(screen.getByText("85")).toBeTruthy();
    expect(screen.getAllByText(/Điểm đạt: 70/).length).toBe(1);
    expect(screen.getByText("Cao hơn điểm đạt 15 điểm")).toBeTruthy();
    const quizCard = within(screen.getByLabelText("Quiz an toàn"));
    expect(quizCard.getByText("Đạt")).toBeTruthy();
    expect(screen.getByText("Đang chờ chấm điểm")).toBeTruthy();
    expect(screen.getByText("Chờ chấm")).toBeTruthy();
    expect(screen.getByText("Lượt 1: 50 · Lượt 2: 85 (hết giờ)")).toBeTruthy();
    expect(screen.getByLabelText("Điểm 85, điểm đạt 70")).toBeTruthy();
    expect(screen.getByLabelText("Chưa có điểm, điểm đạt 60")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /Score|Passing|Passed|Awaiting|Quiz result|Back/,
    );
    // the words of the glossary: bài trắc nghiệm, never bài kiểm tra; no line of text in capitals
    expect(document.body.textContent).not.toMatch(/kiểm tra/i);
    expect(document.body.textContent).not.toMatch(/KHÓA HỌC|KẾT QUẢ|BÀI TRẮC/);
    expect(document.body.textContent).toContain("Bài trắc nghiệm");
  });

  it("the summary above the list counts what passed, what did not and what waits", async () => {
    load.mockResolvedValue(
      data([
        quiz(),
        quiz({
          assessmentId: "q-2",
          title: "Quiz hai",
          recordedScore: 30,
          passed: false,
        }),
        assignment(),
      ]),
    );
    open();
    expect(
      await screen.findByText(
        "Đã làm 3 bài, đạt 1, chưa đạt 1, chờ kết quả 1.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Đã làm").nextSibling?.textContent ??
        screen.getByText("Đã làm").parentElement?.textContent,
    ).toMatch(/3/);
  });

  it("a score below the passing score says how many points are missing; a score of 0 is shown as 0, not as empty", async () => {
    load.mockResolvedValue(data([quiz({ recordedScore: 0, passed: false })]));
    open();
    expect(await screen.findByText("Còn thiếu 70 điểm để đạt")).toBeTruthy();
    expect(
      within(screen.getByLabelText("Quiz an toàn")).getByText("Chưa đạt"),
    ).toBeTruthy();
    expect(
      document.querySelector(".course-results-number")?.textContent,
    ).toMatch(/^0/);
  });

  it("a component that is disabled is marked and explained, and keeps its score", async () => {
    load.mockResolvedValue(data([quiz({ disabled: true })]));
    open();
    expect(await screen.findByText("Đã vô hiệu hóa")).toBeTruthy();
    expect(
      screen.getByText(/không tính vào điều kiện cấp chứng chỉ/),
    ).toBeTruthy();
    expect(screen.getByText("85")).toBeTruthy();
  });

  it("an optional Quiz is told as such", async () => {
    load.mockResolvedValue(data([quiz({ isRequired: false })]));
    open();
    expect(await screen.findByText(/Không bắt buộc/)).toBeTruthy();
  });

  it("the buttons lead to the history of a Quiz, to the grading of an Assignment, and back to the list", async () => {
    load.mockResolvedValue(
      data([
        quiz(),
        assignment({
          assessmentId: "a-9",
          title: "Bài đã chấm",
          status: "Completed",
          recordedScore: 80,
          passed: true,
        }),
      ]),
    );
    open();
    fireEvent.click(await screen.findByText("Lịch sử làm bài"));
    expect(path).toBe("/learner/courses/enr-1/quizzes/q-1/history");
    cleanup();
    open();
    fireEvent.click(await screen.findByText("Xem kết quả chấm"));
    expect(path).toBe("/learner/courses/enr-1/assignments/a-9/result");
    cleanup();
    open();
    fireEvent.click(
      (await screen.findAllByText("Quay lại danh sách bài đánh giá"))[0],
    );
    expect(path).toBe("/learner/courses/enr-1/assessments");
  });

  it("nothing done yet: says so and leads to the list, no table", async () => {
    load.mockResolvedValue(data([]));
    open();
    expect(await screen.findByText("Bạn chưa làm bài nào")).toBeTruthy();
    fireEvent.click(screen.getByText("Đến danh sách bài đánh giá"));
    expect(path).toBe("/learner/courses/enr-1/assessments");
  });

  it("when the grading service cannot be asked it says so and offers to try again; it does not show an empty list", async () => {
    load.mockResolvedValueOnce({
      enrollment: { id: "enr-1", courseId: "course-1", status: "InProgress" },
      state: "unavailable",
    });
    open();
    expect(
      await screen.findByText("Chưa lấy được kết quả bài đánh giá"),
    ).toBeTruthy();
    expect(screen.queryByText("Bạn chưa làm bài nào")).toBeNull();
    load.mockResolvedValue(data([quiz()]));
    fireEvent.click(screen.getByText("Thử lại"));
    expect(await screen.findByText("Quiz an toàn")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("state unavailable wins over a list that came with it: the page does not show scores it cannot vouch for", async () => {
    load.mockResolvedValueOnce(data([quiz()], { state: "unavailable" }));
    open();
    expect(
      await screen.findByText("Chưa lấy được kết quả bài đánh giá"),
    ).toBeTruthy();
    expect(screen.queryByText("Quiz an toàn")).toBeNull();
  });

  it("an Enrollment that is not the Learner's, or is halted, is told like the other Course screens", async () => {
    load.mockRejectedValueOnce(new ApiError(404, "ENROLLMENT_NOT_FOUND", "x"));
    open();
    expect(await screen.findByText("Về Khóa học của tôi")).toBeTruthy();
    cleanup();
    load.mockRejectedValueOnce(new ApiError(403, "CONTENT_UNAVAILABLE", "x"));
    open();
    expect(await screen.findByText(/Về/)).toBeTruthy();
  });
});
