// @vitest-environment jsdom
// UC29.2: the Learner reads the attempts they have done on a Quiz. jsdom is for this file only.
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
vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  fetchQuizHistoryAPI: vi.fn(),
}));

import * as api from "@/services/assessment.service";
import QuizHistory from "./quiz.history";

const fetchHistory = vi.mocked(api.fetchQuizHistoryAPI);
const ok = (data: unknown) => ({ statusCode: 200, data }) as never;

const attempts = (over: Record<string, unknown> = {}) => ({
  maxConsecutiveAttempts: 3,
  remainingAttempts: 1,
  lockoutHours: 1,
  lockedUntil: null,
  ...over,
});
const item = (over: Record<string, unknown>) => ({
  attemptId: "a",
  attemptNumber: 1,
  status: "Submitted",
  startedAt: "2026-11-05T10:00:00.000Z",
  submittedAt: "2026-11-05T10:05:00.000Z",
  submissionKind: "Manual",
  score: 50,
  passed: false,
  correctCount: 2,
  totalQuestions: 4,
  isRecorded: false,
  ...over,
});
const history = (over: Record<string, unknown> = {}) => ({
  quizId: "quiz-1",
  courseId: "course-1",
  title: "Quiz an toàn",
  passingScore: 70,
  readOnly: false,
  attempts: attempts(),
  recordedScore: 100,
  passed: true,
  items: [
    item({
      attemptId: "a2",
      attemptNumber: 2,
      score: 100,
      passed: true,
      correctCount: 4,
      isRecorded: true,
    }),
    item({ attemptId: "a1", attemptNumber: 1 }),
  ],
  ...over,
});

let path = "";
const Where = () => {
  path = useLocation().pathname;
  return null;
};
const open = () =>
  render(
    <MemoryRouter
      initialEntries={["/learner/courses/enr-1/quizzes/quiz-1/history"]}
    >
      <Routes>
        <Route
          path="/learner/courses/:enrollmentId/quizzes/:quizId/history"
          element={
            <>
              <QuizHistory />
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
  fetchHistory.mockReset();
  fetchHistory.mockResolvedValue(ok(history()));
});
afterEach(cleanup);

describe("the history of a Quiz", () => {
  it("lists the attempts newest first with score, correct answers and result, in Vietnamese", async () => {
    open();
    expect(await screen.findByText("Lượt 2")).toBeTruthy();
    const rows = Array.from(document.querySelectorAll("tbody tr")).map(
      (r) => r.textContent ?? "",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Lượt 2");
    expect(rows[0]).toContain("4/4");
    expect(rows[0]).toContain("Đạt");
    expect(rows[1]).toContain("Lượt 1");
    expect(rows[1]).toContain("2/4");
    expect(rows[1]).toContain("Chưa đạt");
    for (const text of [
      "Bắt đầu",
      "Nộp lúc",
      "Cách nộp",
      "Số câu đúng",
      "Kết quả",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(document.body.textContent).not.toMatch(
      /Attempt|Submitted|Score|Passed|Below|History/,
    );
  });

  it("marks the attempt that gives the recorded score, only one", async () => {
    open();
    await screen.findByText("Lượt 2");
    expect(screen.getAllByText("Được ghi nhận")).toHaveLength(1);
    expect(document.querySelectorAll("tbody tr")[0].textContent).toContain(
      "Được ghi nhận",
    );
  });

  it("shows start and submission timestamps date-first in Vietnam time", async () => {
    fetchHistory.mockResolvedValue(ok(history({
      items: [item({
        startedAt: "2026-11-05T23:40:00Z",
        submittedAt: "2026-11-05T23:45:00Z",
      })],
    })));
    open();
    expect(await screen.findByText("06/11/2026 06:40")).toBeTruthy();
    expect(screen.getByText("06/11/2026 06:45")).toBeTruthy();
    expect(screen.getByText("50%", { selector: "td" })).toBeTruthy();
  });

  it("shows the recorded score and the tries left before the lock", async () => {
    open();
    expect(await screen.findByText("100% (lượt có điểm cao nhất) · Đạt")).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
  });

  it("says how each attempt was submitted: by the Learner, by the time running out, or still running", async () => {
    fetchHistory.mockResolvedValue(
      ok(
        history({
          items: [
            item({
              attemptId: "c",
              attemptNumber: 3,
              status: "InProgress",
              submittedAt: null,
              submissionKind: null,
              score: null,
              passed: null,
              correctCount: null,
            }),
            item({
              attemptId: "b",
              attemptNumber: 2,
              submissionKind: "TimedOut",
            }),
            item({ attemptId: "a", attemptNumber: 1 }),
          ],
        }),
      ),
    );
    open();
    await screen.findByText("Lượt 3");
    const rows = Array.from(document.querySelectorAll("tbody tr")).map(
      (r) => r.textContent ?? "",
    );
    expect(rows[0]).toContain("Đang làm");
    expect(rows[0]).not.toContain("Đạt");
    expect(rows[1]).toContain("Hết giờ, tự nộp");
    expect(rows[2]).toContain("Bạn nộp");
  });

  it("a locked Quiz says when it opens again, with no remaining tries, and offers no new attempt", async () => {
    fetchHistory.mockResolvedValue(
      ok(
        history({
          attempts: attempts({
            remainingAttempts: 0,
            lockedUntil: "2026-11-05T12:00:00.000Z",
          }),
        }),
      ),
    );
    open();
    expect(await screen.findByText("Bài trắc nghiệm đang tạm khóa")).toBeTruthy();
    expect(screen.getByText(/0\/3 · mở lại/)).toBeTruthy();
    expect(screen.queryByText("Bắt đầu làm bài")).toBeNull();
  });

  it("a Completed Course shows the history and offers no new attempt", async () => {
    fetchHistory.mockResolvedValue(ok(history({ readOnly: true })));
    open();
    await screen.findByText("Lượt 2");
    expect(screen.queryByText("Bắt đầu làm bài")).toBeNull();
    expect(screen.getByText("Quay lại danh sách bài đánh giá")).toBeTruthy();
  });

  it("no attempt yet: says so, and there is no recorded score", async () => {
    fetchHistory.mockResolvedValue(
      ok(
        history({
          items: [],
          recordedScore: null,
          passed: null,
          attempts: attempts({ remainingAttempts: 3 }),
        }),
      ),
    );
    open();
    expect(await screen.findByText("Bạn chưa làm lượt nào.")).toBeTruthy();
    expect(screen.getByText("Chưa có lượt nào được nộp")).toBeTruthy();
    expect(screen.getByText("3/3")).toBeTruthy();
  });

  it("the buttons go to the Quiz and to the list of the Course", async () => {
    open();
    fireEvent.click(await screen.findByText("Bắt đầu làm bài"));
    expect(path).toBe("/learner/courses/enr-1/quizzes/quiz-1");
    cleanup();
    open();
    fireEvent.click(await screen.findByText("Quay lại danh sách bài đánh giá"));
    expect(path).toBe("/learner/courses/enr-1/assessments");
  });

  it("a running attempt turns the button into 'Tiếp tục làm bài'", async () => {
    fetchHistory.mockResolvedValue(
      ok(
        history({
          items: [
            item({
              attemptId: "r",
              attemptNumber: 1,
              status: "InProgress",
              submittedAt: null,
              submissionKind: null,
              score: null,
              passed: null,
              correctCount: null,
            }),
          ],
        }),
      ),
    );
    open();
    expect(await screen.findByText("Tiếp tục làm bài")).toBeTruthy();
  });

  it("a refusal or a lost connection is told in Vietnamese and can be retried", async () => {
    fetchHistory.mockResolvedValueOnce({
      statusCode: 403,
      error: { code: "NOT_ENROLLED", message: "English" },
    } as never);
    open();
    expect(
      await screen.findByText(
        "Bạn chưa ghi danh vào khóa học có bài trắc nghiệm này.",
      ),
    ).toBeTruthy();
    fetchHistory.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("Thử lại"));
    expect(
      await screen.findByText(
        "Không kết nối được với máy chủ. Vui lòng thử lại.",
      ),
    ).toBeTruthy();
    fetchHistory.mockResolvedValue(ok(history()));
    fireEvent.click(screen.getByText("Thử lại"));
    expect(await screen.findByText("Lượt 2")).toBeTruthy();
  });
});

it("uses the generic Vietnamese message for an unknown quiz history error", async () => {
  fetchHistory.mockResolvedValueOnce({
    statusCode: 400,
    error: { code: "NEW_CODE", message: "Internal English text" },
  } as never);
  open();
  await screen.findByText("Không thực hiện được thao tác. Vui lòng thử lại.");
  expect(screen.queryByText("Internal English text")).toBeNull();
});
