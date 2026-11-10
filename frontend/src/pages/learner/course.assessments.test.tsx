// @vitest-environment jsdom
// UC29 / UC29.1: the list of Quizzes and Assignments of a Course, in Vietnamese, with the way into each Quiz. jsdom is for this file only.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
vi.mock("@/hooks/use.api.query", () => ({
  useApiQuery: () => ({
    status: "success",
    data: { courseId: "course-1" },
    reload: () => undefined,
  }),
}));
vi.mock("@/services/learning.service", () => ({ fetchCurriculum: vi.fn() }));
vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  fetchLearnerAssessmentsAPI: vi.fn(),
}));

import * as api from "@/services/assessment.service";
import CourseAssessments from "./course.assessments";

const list = vi.mocked(api.fetchLearnerAssessmentsAPI);

const attempts = (over: Record<string, unknown> = {}) => ({
  maxConsecutiveAttempts: 3,
  remainingAttempts: 3,
  lockoutHours: 1,
  lockedUntil: null,
  ...over,
});
const item = (over: Record<string, unknown>) => ({
  id: "x",
  kind: "QUIZ",
  title: "Bài",
  moduleId: null,
  isRequired: true,
  passingScore: 70,
  timeLimitMinutes: 15,
  expectedDurationMinutes: null,
  status: "NotStarted",
  recordedScore: null,
  passed: null,
  submittedAt: null,
  attempts: attempts(),
  ...over,
});
const answer = (items: unknown[], readOnly = false) =>
  ({
    statusCode: 200,
    data: { courseId: "course-1", enrollmentId: "enr-1", readOnly, items },
  }) as never;

let path = "";
const Where = () => {
  path = useLocation().pathname;
  return null;
};
const open = () =>
  render(
    <MemoryRouter initialEntries={["/learner/courses/enr-1/assessments"]}>
      <Routes>
        <Route
          path="/learner/courses/:enrollmentId/assessments"
          element={
            <>
              <CourseAssessments />
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
beforeEach(() => list.mockReset());
afterEach(cleanup);

describe("the list of assessments", () => {
  it("is in Vietnamese: the columns, the kinds, the requirement and the footnote", async () => {
    list.mockResolvedValue(
      answer([
        item({ id: "q1", title: "Quiz an toàn", kind: "QUIZ" }),
        item({
          id: "a1",
          title: "Bài tập lớn",
          kind: "ASSIGNMENT",
          timeLimitMinutes: null,
          expectedDurationMinutes: 45,
        }),
        item({ id: "q2", title: "Quiz tùy chọn", isRequired: false }),
      ]),
    );
    open();
    expect(await screen.findByText("Quiz an toàn")).toBeTruthy();
    for (const text of [
      "Bài đánh giá",
      "Yêu cầu",
      "Điểm đạt",
      "Trạng thái",
      "Lượt còn lại",
      "Thao tác",
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(
      screen.getAllByText("Bài trắc nghiệm, 15 phút", { selector: "small" }),
    ).toHaveLength(2);
    expect(screen.getByText("Bài tập, khoảng 45 phút")).toBeTruthy();
    expect(screen.getByText("Không bắt buộc")).toBeTruthy();
    expect(screen.getAllByText("Chưa làm").length).toBe(3);
    expect(document.body.textContent).not.toMatch(
      /Assessment|Required|Optional|Tries left|Passing score|Status|Action|Loading/,
    );
  });

  it("a Quiz not started opens its page with 'Bắt đầu làm bài'", async () => {
    list.mockResolvedValue(answer([item({ id: "q1", title: "Quiz an toàn" })]));
    open();
    fireEvent.click(await screen.findByText("Bắt đầu làm bài"));
    expect(path).toBe("/learner/courses/enr-1/quizzes/q1");
  });

  it("a Quiz in progress says 'Tiếp tục làm bài'", async () => {
    list.mockResolvedValue(
      answer([
        item({
          id: "q1",
          status: "InProgress",
          attempts: attempts({ remainingAttempts: 2 }),
        }),
      ]),
    );
    open();
    expect(await screen.findByText("Đang làm")).toBeTruthy();
    fireEvent.click(screen.getByText("Tiếp tục làm bài"));
    expect(path).toBe("/learner/courses/enr-1/quizzes/q1");
  });

  it("a Quiz that was done can be done again or its history read; its score and verdict are shown", async () => {
    list.mockResolvedValue(
      answer([
        item({
          id: "q1",
          status: "Completed",
          recordedScore: 85,
          passed: true,
          attempts: attempts({ remainingAttempts: 2 }),
        }),
      ]),
    );
    open();
    expect(await screen.findByText("Đạt")).toBeTruthy();
    expect(screen.getByText("85%")).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
    fireEvent.click(screen.getByText("Lịch sử"));
    expect(path).toBe("/learner/courses/enr-1/quizzes/q1/history");
    cleanup();
    list.mockResolvedValue(
      answer([
        item({
          id: "q1",
          status: "Completed",
          recordedScore: 40,
          passed: false,
        }),
      ]),
    );
    open();
    expect(await screen.findByText("Chưa đạt")).toBeTruthy();
    fireEvent.click(screen.getByText("Làm lại"));
    expect(path).toBe("/learner/courses/enr-1/quizzes/q1");
  });

  it("a locked Quiz cannot be started and says when it opens again", async () => {
    list.mockResolvedValue(
      answer([
        item({
          id: "q1",
          status: "Completed",
          attempts: attempts({
            remainingAttempts: 0,
            lockedUntil: "2026-11-05T12:00:00.000Z",
          }),
        }),
      ]),
    );
    open();
    expect(await screen.findByText(/Mở lại/)).toBeTruthy();
    const button = screen
      .getByText("Đang tạm khóa")
      .closest("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("in a Completed Course nothing new starts: the Quiz can only be looked at", async () => {
    list.mockResolvedValue(answer([item({ id: "q1" })], true));
    open();
    expect(await screen.findByText("Khóa học đã hoàn thành")).toBeTruthy();
    fireEvent.click(screen.getByText("Xem"));
    expect(path).toBe("/learner/courses/enr-1/quizzes/q1");
    expect(screen.queryByText("Bắt đầu làm bài")).toBeNull();
  });

  it("a Quiz still running in a Completed Course can be continued (BR-211)", async () => {
    list.mockResolvedValue(
      answer([item({ id: "q1", status: "InProgress" })], true),
    );
    open();
    expect(await screen.findByText("Tiếp tục làm bài")).toBeTruthy();
  });

  it("the Assignment keeps its buttons, in Vietnamese", async () => {
    list.mockResolvedValue(
      answer([
        item({
          id: "a1",
          kind: "ASSIGNMENT",
          status: "NotStarted",
          timeLimitMinutes: null,
        }),
        item({
          id: "a2",
          kind: "ASSIGNMENT",
          status: "Completed",
          recordedScore: 90,
          passed: true,
        }),
      ]),
    );
    open();
    expect(await screen.findByText("Bắt đầu làm bài")).toBeTruthy();
    expect(screen.getAllByText("Xem kết quả")).toHaveLength(2); // the header of the page and the row
    fireEvent.click(screen.getByText("Nộp lại"));
    expect(path).toBe("/learner/courses/enr-1/assignments/a2/resubmit");
  });

  it("the page leads to the results of the Course (UC28.1)", async () => {
    list.mockResolvedValue(answer([item({ id: "q1" })]));
    open();
    fireEvent.click(await screen.findByText("Xem kết quả"));
    expect(path).toBe("/learner/courses/enr-1/results");
  });

  it("a failed load is told in Vietnamese and can be retried", async () => {
    list.mockRejectedValueOnce(new Error("down"));
    open();
    expect(
      await screen.findByText("Không tải được danh sách bài đánh giá"),
    ).toBeTruthy();
    expect(
      screen.getByText("Không kết nối được với máy chủ. Vui lòng thử lại."),
    ).toBeTruthy();
    list.mockResolvedValue(answer([]));
    fireEvent.click(screen.getByText("Thử lại"));
    expect(
      await screen.findByText("Khóa học này chưa có bài đánh giá nào."),
    ).toBeTruthy();
  });
});
