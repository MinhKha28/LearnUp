// @vitest-environment jsdom
// UC29.1: the Learner takes a Quiz, by interaction. jsdom is for this file only.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  fetchLearnerQuizAPI: vi.fn(),
  startQuizAttemptAPI: vi.fn(),
  fetchQuizAttemptAPI: vi.fn(),
  saveQuizAnswerAPI: vi.fn(),
  submitQuizAttemptAPI: vi.fn(),
}));

import * as api from "@/services/assessment.service";
import QuizTake from "./quiz.take";

const quiz = vi.mocked(api.fetchLearnerQuizAPI);
const start = vi.mocked(api.startQuizAttemptAPI);
const attemptOf = vi.mocked(api.fetchQuizAttemptAPI);
const save = vi.mocked(api.saveQuizAnswerAPI);
const submit = vi.mocked(api.submitQuizAttemptAPI);

const ok = (data: unknown) => ({ statusCode: 200, data }) as never;
const refused = (code: string) =>
  ({
    statusCode: 409,
    error: { code, message: "English message from the server" },
  }) as never;

const attempts = (over: Record<string, unknown> = {}) => ({
  maxConsecutiveAttempts: 2,
  remainingAttempts: 2,
  lockoutHours: 1,
  lockedUntil: null,
  ...over,
});
const quizInfo = (over: Record<string, unknown> = {}) => ({
  id: "quiz-1",
  courseId: "course-1",
  title: "Bài trắc nghiệm an toàn",
  passingScore: 70,
  timeLimitMinutes: 10,
  questionCount: 3,
  isRequired: true,
  readOnly: false,
  attempts: attempts(),
  inProgressAttemptId: null,
  recordedScore: null,
  passed: null,
  submittedAttemptCount: 0,
  ...over,
});

const question = (
  id: string,
  type: string,
  options: string[],
  selected: string[] = [],
) => ({
  id,
  position: 1,
  type,
  content: `Nội dung ${id}`,
  options: options.map((content, i) => ({
    id: `${id}-o${i}`,
    position: i + 1,
    content,
  })),
  selectedOptionIds: selected,
});
const running = (over: Record<string, unknown> = {}) => ({
  status: "InProgress" as const,
  attemptId: "att-1",
  assessmentId: "quiz-1",
  attemptNumber: 1,
  title: "Bài trắc nghiệm an toàn",
  startedAt: "2026-11-05T10:00:00.000Z",
  deadlineAt: "2026-11-05T10:10:00.000Z",
  serverNow: "2026-11-05T10:00:00.000Z",
  remainingSeconds: 600,
  questions: [
    question("q1", "SingleChoice", ["Phương án A", "Phương án B"]),
    question("q2", "MultipleChoice", ["X", "Y", "Z"]),
    question("q3", "TrueFalse", ["Đúng", "Sai"]),
  ],
  ...over,
});
const result = (over: Record<string, unknown> = {}) => ({
  status: "Submitted" as const,
  attemptId: "att-1",
  assessmentId: "quiz-1",
  attemptNumber: 1,
  title: "Bài trắc nghiệm an toàn",
  startedAt: "2026-11-05T10:00:00.000Z",
  submittedAt: "2026-11-05T10:05:00.000Z",
  submissionKind: "Manual",
  score: 66.67,
  passed: false,
  correctCount: 2,
  totalQuestions: 3,
  passingScore: 70,
  recordedScore: 66.67,
  recordedPassed: false,
  attempts: attempts({ remainingAttempts: 1 }),
  ...over,
});

let path = "";
const Where = () => {
  path = useLocation().pathname;
  return null;
};
const open = () =>
  render(
    <MemoryRouter initialEntries={["/learner/courses/enr-1/quizzes/quiz-1"]}>
      <Routes>
        <Route
          path="/learner/courses/:enrollmentId/quizzes/:quizId"
          element={
            <>
              <QuizTake />
              <Where />
            </>
          }
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
const begin = async () => {
  open();
  fireEvent.click(await screen.findByText("Bắt đầu làm bài"));
  await screen.findByText("Câu 1");
};

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
  for (const mock of [quiz, start, attemptOf, save, submit]) mock.mockReset();
  quiz.mockResolvedValue(ok(quizInfo()));
  start.mockResolvedValue(ok(running()));
  save.mockImplementation(((_a: string, questionId: string, ids: string[]) =>
    Promise.resolve(
      ok({ questionId, selectedOptionIds: ids, remainingSeconds: 500 }),
    )) as never);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("before the attempt", () => {
  it("shows the rules in Vietnamese: questions, time, passing score, tries left; nothing in English", async () => {
    open();
    expect(await screen.findByText("Bài trắc nghiệm an toàn")).toBeTruthy();
    expect(screen.getByText("Số câu hỏi")).toBeTruthy();
    expect(screen.getByText("10 phút")).toBeTruthy();
    expect(screen.getByText("2/2")).toBeTruthy();
    expect(screen.getByText("Bắt đầu làm bài")).toBeTruthy();
    expect(screen.getByText(/Đồng hồ chạy theo thời gian thực/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /Start|Attempts left|Quiz information|Passing score/,
    );
  });

  it("shows the recorded score and whether it passes", async () => {
    quiz.mockResolvedValue(
      ok(
        quizInfo({
          recordedScore: 85.5,
          passed: true,
          submittedAttemptCount: 1,
        }),
      ),
    );
    open();
    expect(await screen.findByText("Điểm hiện được ghi nhận")).toBeTruthy();
    expect(screen.getByText("85,5")).toBeTruthy();
    expect(screen.getByText(/Bạn đã đạt/)).toBeTruthy();
    expect(screen.getByText("Lịch sử làm bài")).toBeTruthy();
  });

  it("a locked Quiz says when it opens again and cannot be started", async () => {
    quiz.mockResolvedValue(
      ok(
        quizInfo({
          attempts: attempts({
            remainingAttempts: 0,
            lockedUntil: "2026-11-05T12:00:00.000Z",
          }),
        }),
      ),
    );
    open();
    expect(
      await screen.findByText("Bài trắc nghiệm đang tạm khóa"),
    ).toBeTruthy();
    expect(screen.getByText(/Bạn làm lại được từ/)).toBeTruthy();
    expect(
      (
        screen
          .getByText("Bắt đầu làm bài")
          .closest("button") as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("a Completed Course cannot start a new attempt, but a running one can be continued", async () => {
    quiz.mockResolvedValue(ok(quizInfo({ readOnly: true })));
    open();
    expect(await screen.findByText("Khóa học đã hoàn thành")).toBeTruthy();
    expect(
      (
        screen
          .getByText("Bắt đầu làm bài")
          .closest("button") as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    cleanup();
    quiz.mockResolvedValue(
      ok(quizInfo({ readOnly: true, inProgressAttemptId: "att-1" })),
    );
    open();
    const resume = await screen.findByText("Tiếp tục làm bài");
    expect((resume.closest("button") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("a Quiz without question cannot be started", async () => {
    quiz.mockResolvedValue(ok(quizInfo({ questionCount: 0 })));
    open();
    await screen.findByText("Bài trắc nghiệm an toàn");
    expect(
      (
        screen
          .getByText("Bắt đầu làm bài")
          .closest("button") as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("a failed load says so in Vietnamese and can be tried again", async () => {
    quiz.mockResolvedValueOnce(refused("NOT_ENROLLED"));
    open();
    expect(
      await screen.findByText(
        "Bạn chưa ghi danh vào khóa học có bài trắc nghiệm này.",
      ),
    ).toBeTruthy();
    quiz.mockResolvedValue(ok(quizInfo()));
    fireEvent.click(screen.getByText("Thử lại"));
    expect(await screen.findByText("Bắt đầu làm bài")).toBeTruthy();
  });

  it("a refused start tells why and loads the Quiz again", async () => {
    start.mockResolvedValue(refused("ASSESSMENT_LOCKED"));
    open();
    fireEvent.click(await screen.findByText("Bắt đầu làm bài"));
    expect(
      await screen.findByText(
        "Bạn đã làm đủ số lượt liên tiếp nên bài trắc nghiệm đang tạm khóa.",
      ),
    ).toBeTruthy();
    await waitFor(() => expect(quiz).toHaveBeenCalledTimes(2));
  });
});

describe("during the attempt", () => {
  it("shows the questions with the time left, and no question is chosen at first", async () => {
    await begin();
    expect(screen.getByText("10:00")).toBeTruthy();
    expect(screen.getByText("Thời gian còn lại")).toBeTruthy();
    expect(screen.getByText("Một đáp án")).toBeTruthy();
    expect(screen.getByText("Nhiều đáp án")).toBeTruthy();
    expect(screen.getByText("Đúng / Sai")).toBeTruthy();
    expect(screen.getByText("Đã trả lời 0/3 câu")).toBeTruthy();
    expect(document.querySelectorAll(".quiz-option.selected").length).toBe(0);
  });

  it("a choice is saved at once; a new choice in a single-choice question replaces the old one", async () => {
    await begin();
    fireEvent.click(screen.getByText("Phương án A"));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("att-1", "q1", ["q1-o0"]),
    );
    expect(
      screen
        .getByText("Phương án A")
        .closest("button")!
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByText("Phương án B"));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("att-1", "q1", ["q1-o1"]),
    );
    expect(
      screen
        .getByText("Phương án A")
        .closest("button")!
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(await screen.findByText("Đã lưu")).toBeTruthy();
    expect(screen.getByText("Đã trả lời 1/3 câu")).toBeTruthy();
  });

  it("a multiple-choice question toggles each option and saves the whole set", async () => {
    await begin();
    fireEvent.click(screen.getByText("X"));
    fireEvent.click(screen.getByText("Y"));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("att-1", "q2", ["q2-o0", "q2-o1"]),
    );
    fireEvent.click(screen.getByText("X"));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("att-1", "q2", ["q2-o1"]),
    );
    fireEvent.click(screen.getByText("Y"));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("att-1", "q2", []),
    );
  });

  it("the saves of one question go to the server in the order of the clicks", async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    save.mockImplementation(((_a: string, _q: string, ids: string[]) => {
      order.push(`start ${ids.join()}`);
      const wait =
        order.length === 1
          ? new Promise<void>((resolve) => (release = resolve))
          : Promise.resolve();
      return wait.then(() => {
        order.push(`end ${ids.join()}`);
        return ok({
          questionId: "q2",
          selectedOptionIds: ids,
          remainingSeconds: 1,
        });
      });
    }) as never);
    await begin();
    fireEvent.click(screen.getByText("X"));
    fireEvent.click(screen.getByText("Y"));
    await waitFor(() => expect(order).toEqual(["start q2-o0"]));
    release();
    await waitFor(() =>
      expect(order).toEqual([
        "start q2-o0",
        "end q2-o0",
        "start q2-o0,q2-o1",
        "end q2-o0,q2-o1",
      ]),
    );
  });

  it("a choice that could not be saved says so in Vietnamese", async () => {
    await begin();
    save.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("Phương án A"));
    expect(
      await screen.findByText(/Chưa lưu được câu trả lời vì mất kết nối/),
    ).toBeTruthy();
    expect(screen.getByText("Chưa lưu được")).toBeTruthy();
  });

  const pressed = (text: string) =>
    screen.getByText(text).closest("button")!.getAttribute("aria-pressed");

  it("a failed save is not forgotten when another question is answered: the choice goes back, the question stays marked and the page does not say 'Đã lưu'", async () => {
    await begin();
    save.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("Phương án A"));
    expect(
      await screen.findByText(/Đáp án của câu này chưa được lưu lên máy chủ/),
    ).toBeTruthy();
    // the page shows what the server has, not a choice that never arrived
    expect(pressed("Phương án A")).toBe("false");
    expect(screen.getByText("Đã trả lời 0/3 câu")).toBeTruthy();

    fireEvent.click(screen.getByText("Đúng"));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("att-1", "q3", ["q3-o0"]),
    );
    await waitFor(() =>
      expect(screen.getByText("Đã trả lời 1/3 câu")).toBeTruthy(),
    );
    expect(screen.queryByText("Đã lưu")).toBeNull();
    expect(screen.getByText("Chưa lưu được")).toBeTruthy();
    expect(
      screen.getAllByText(/Đáp án của câu này chưa được lưu lên máy chủ/)
        .length,
    ).toBe(1);
    expect(screen.getByText(/Câu 1 chưa được lưu/)).toBeTruthy();
  });

  it("choosing the same option again after a failure sends the save again, and a save that works clears the mark", async () => {
    await begin();
    save.mockResolvedValueOnce(refused("SOMETHING_ELSE"));
    fireEvent.click(screen.getByText("Phương án A"));
    await screen.findByText(/Đáp án của câu này chưa được lưu lên máy chủ/);
    expect(save).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Phương án A"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("att-1", "q1", ["q1-o0"]);
    await waitFor(() =>
      expect(
        screen.queryByText(/Đáp án của câu này chưa được lưu lên máy chủ/),
      ).toBeNull(),
    );
    expect(pressed("Phương án A")).toBe("true");
    expect(await screen.findByText("Đã lưu")).toBeTruthy();
    expect(screen.getByText("Đã trả lời 1/3 câu")).toBeTruthy();
  });

  it("a failed save in a multiple-choice question goes back to the set the server has", async () => {
    await begin();
    fireEvent.click(screen.getByText("X"));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("att-1", "q2", ["q2-o0"]),
    );
    await screen.findByText("Đã lưu");
    save.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("Y"));
    await screen.findByText(/Đáp án của câu này chưa được lưu lên máy chủ/);
    expect(pressed("X")).toBe("true");
    expect(pressed("Y")).toBe("false");
  });

  it("an older click that fails does not undo a newer click on the same question that works", async () => {
    let failFirst: () => void = () => undefined;
    save.mockImplementationOnce(
      (() =>
        new Promise((_resolve, reject) => {
          failFirst = () => reject(new Error("offline"));
        })) as never,
    );
    await begin();
    fireEvent.click(screen.getByText("X"));
    fireEvent.click(screen.getByText("Y"));
    // the first save is on its way (the second waits behind it); now it fails
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    failFirst();
    // the second save carries both options, so the question is saved as the Learner sees it
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("att-1", "q2", ["q2-o0", "q2-o1"]),
    );
    expect(await screen.findByText("Đã lưu")).toBeTruthy();
    expect(pressed("X")).toBe("true");
    expect(pressed("Y")).toBe("true");
    expect(
      screen.queryByText(/Đáp án của câu này chưa được lưu lên máy chủ/),
    ).toBeNull();
  });

  it("the mark stays while a newer click on the question is still on its way, and goes when that save works", async () => {
    let releaseLast: () => void = () => undefined;
    let calls = 0;
    save.mockImplementation(((
      _a: string,
      questionId: string,
      ids: string[],
    ) => {
      calls += 1;
      const reply = ok({
        questionId,
        selectedOptionIds: ids,
        remainingSeconds: 1,
      });
      if (calls === 1) return Promise.reject(new Error("offline"));
      if (calls === 2) return Promise.resolve(reply);
      return new Promise((resolve) => {
        releaseLast = () => resolve(reply);
      });
    }) as never);
    await begin();
    fireEvent.click(screen.getByText("X")); // call 1 fails
    await screen.findByText(/Đáp án của câu này chưa được lưu lên máy chủ/);
    fireEvent.click(screen.getByText("Y")); // call 2 works
    fireEvent.click(screen.getByText("Z")); // call 3 is held
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(
      screen.getByText(/Đáp án của câu này chưa được lưu lên máy chủ/),
    ).toBeTruthy();
    releaseLast();
    await waitFor(() =>
      expect(
        screen.queryByText(/Đáp án của câu này chưa được lưu lên máy chủ/),
      ).toBeNull(),
    );
    expect(await screen.findByText("Đã lưu")).toBeTruthy();
  });

  it("when the newest click fails after an older one worked, the question goes back to the older choice", async () => {
    await begin();
    fireEvent.click(screen.getByText("X"));
    await screen.findByText("Đã lưu");
    save.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("Y"));
    await screen.findByText(/Đáp án của câu này chưa được lưu lên máy chủ/);
    expect(pressed("X")).toBe("true");
    expect(pressed("Y")).toBe("false");
  });

  it("the question that failed is named in the footer and before submitting, and submitting still works", async () => {
    await begin();
    save.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("Phương án B"));
    await screen.findByText(/Đáp án của câu này chưa được lưu lên máy chủ/);
    submit.mockResolvedValue(ok(result()));
    fireEvent.click(screen.getAllByText("Nộp bài")[0]);
    expect(
      await screen.findByText(
        /Câu 1 chưa được lưu lên máy chủ nên sẽ không được chấm/,
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getAllByText("Nộp bài")[1]);
    await waitFor(() => expect(submit).toHaveBeenCalledWith("att-1"));
  });

  it("when the page reads a running attempt again from the server, the marks are gone because the server is the truth", async () => {
    await begin();
    save.mockResolvedValueOnce(refused("ATTEMPT_SUBMITTED"));
    // the server still has an attempt in progress, with the answer it really holds
    attemptOf.mockResolvedValue(
      ok(
        running({
          questions: [
            question(
              "q1",
              "SingleChoice",
              ["Phương án A", "Phương án B"],
              ["q1-o1"],
            ),
            question("q2", "MultipleChoice", ["X", "Y", "Z"]),
            question("q3", "TrueFalse", ["Đúng", "Sai"]),
          ],
        }),
      ),
    );
    fireEvent.click(screen.getByText("Phương án A"));
    await waitFor(() => expect(attemptOf).toHaveBeenCalled());
    await waitFor(() => expect(pressed("Phương án B")).toBe("true"));
    expect(pressed("Phương án A")).toBe("false");
    expect(
      screen.queryByText(/Đáp án của câu này chưa được lưu lên máy chủ/),
    ).toBeNull();
    expect(screen.queryByText(/chưa được lưu./)).toBeNull();
  });

  it("when the server says the time is over, the attempt is read again and the result is shown", async () => {
    await begin();
    save.mockResolvedValueOnce(refused("ATTEMPT_EXPIRED"));
    attemptOf.mockResolvedValue(
      ok(result({ submissionKind: "TimedOut", score: 33.33, correctCount: 1 })),
    );
    fireEvent.click(screen.getByText("Phương án A"));
    expect(await screen.findByText("Kết quả bài trắc nghiệm")).toBeTruthy();
    expect(attemptOf).toHaveBeenCalledWith("att-1");
    expect(screen.getByText(/Hết giờ nên bài được nộp tự động/)).toBeTruthy();
    expect(screen.getByText("33,33")).toBeTruthy();
  });

  it("the countdown runs, and at zero the attempt is read so the server submits it with the answers saved", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-11-05T10:00:00.000Z"));
    start.mockResolvedValue(
      ok(
        running({
          deadlineAt: "2026-11-05T10:00:03.000Z",
          remainingSeconds: 3,
        }),
      ),
    );
    attemptOf.mockResolvedValue(
      ok(
        result({
          submissionKind: "TimedOut",
          score: 0,
          correctCount: 0,
          recordedScore: 0,
        }),
      ),
    );
    open();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByText("Bắt đầu làm bài"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("0:03")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText("0:02")).toBeTruthy();
    expect(attemptOf).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(attemptOf).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Kết quả bài trắc nghiệm")).toBeTruthy();
    expect(screen.getByText(/Hết giờ nên bài được nộp tự động/)).toBeTruthy();
  });

  it("counts from the clock of the server when the clock of the device is wrong", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    // the device thinks it is one hour earlier than the server
    vi.setSystemTime(new Date("2026-11-05T09:00:00.000Z"));
    start.mockResolvedValue(
      ok(running({ serverNow: "2026-11-05T10:00:00.000Z" })),
    );
    open();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByText("Bắt đầu làm bài"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("10:00")).toBeTruthy();
  });

  it("the last minute is marked", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-11-05T10:00:00.000Z"));
    start.mockResolvedValue(
      ok(running({ deadlineAt: "2026-11-05T10:00:45.000Z" })),
    );
    open();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByText("Bắt đầu làm bài"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(document.querySelector(".quiz-timer-low")).toBeTruthy();
  });
});

describe("submitting", () => {
  it("asks first, counts the questions left blank, and submits after the saves have ended", async () => {
    await begin();
    const events: string[] = [];
    let release: () => void = () => undefined;
    save.mockImplementation((() => {
      events.push("save start");
      return new Promise((resolve) => {
        release = () => {
          events.push("save end");
          resolve(
            ok({
              questionId: "q1",
              selectedOptionIds: ["q1-o0"],
              remainingSeconds: 1,
            }),
          );
        };
      });
    }) as never);
    submit.mockImplementation((() => {
      events.push("submit");
      return Promise.resolve(ok(result()));
    }) as never);
    fireEvent.click(screen.getByText("Phương án A"));
    fireEvent.click(screen.getByText("Nộp bài"));
    expect(await screen.findByText("Nộp bài?")).toBeTruthy();
    expect(screen.getByText(/Bạn đã trả lời 1 trên 3 câu/)).toBeTruthy();
    expect(
      screen.getByText(/Câu chưa trả lời sẽ được tính là sai/),
    ).toBeTruthy();
    const buttons = screen.getAllByText("Nộp bài");
    fireEvent.click(buttons[buttons.length - 1]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(events).toEqual(["save start"]);
    release();
    expect(await screen.findByText("Kết quả bài trắc nghiệm")).toBeTruthy();
    expect(events).toEqual(["save start", "save end", "submit"]);
  });

  it("'Xem lại bài' closes the question and nothing is sent", async () => {
    await begin();
    fireEvent.click(screen.getByText("Nộp bài"));
    fireEvent.click(await screen.findByText("Xem lại bài"));
    await waitFor(() =>
      expect(
        document.querySelector(".ant-modal-wrap")?.getAttribute("style") ?? "",
      ).toMatch(/display: none/),
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("a refused submit says why and keeps the attempt on the screen", async () => {
    await begin();
    submit.mockResolvedValue(refused("ATTEMPT_NOT_CLOSED"));
    fireEvent.click(screen.getByText("Nộp bài"));
    const buttons = await screen.findAllByText("Nộp bài");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(
      await screen.findByText("Không nộp được bài. Vui lòng thử lại."),
    ).toBeTruthy();
    expect(screen.getByText("Câu 1")).toBeTruthy();
  });

  it("a lost connection keeps the attempt and tells the Learner to submit again", async () => {
    await begin();
    submit.mockRejectedValue(new Error("offline"));
    fireEvent.click(screen.getByText("Nộp bài"));
    const buttons = await screen.findAllByText("Nộp bài");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(
      await screen.findByText(/Bài của bạn vẫn được lưu, hãy nộp lại/),
    ).toBeTruthy();
    expect(screen.getByText("Câu 1")).toBeTruthy();
  });
});

describe("the result", () => {
  const submitted = async (over: Record<string, unknown> = {}) => {
    submit.mockResolvedValue(ok(result(over)));
    await begin();
    fireEvent.click(screen.getByText("Nộp bài"));
    const buttons = await screen.findAllByText("Nộp bài");
    fireEvent.click(buttons[buttons.length - 1]);
    await screen.findByText("Kết quả bài trắc nghiệm");
  };

  it("shows the score of the attempt, the recorded score, the passing score and the questions right, in Vietnamese", async () => {
    await submitted({ score: 66.67, recordedScore: 90, passed: false });
    expect(screen.getByText("Điểm lượt này")).toBeTruthy();
    expect(screen.getByText("66,67")).toBeTruthy();
    expect(screen.getByText("90")).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(screen.getByText("Chưa đạt")).toBeTruthy();
    expect(
      screen.getByText(/Bạn còn 1 lượt trước khi bài trắc nghiệm tạm khóa/),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /Quiz result|Recorded|Attempt score/,
    );
  });

  it("a pass is marked as such", async () => {
    await submitted({
      score: 100,
      passed: true,
      correctCount: 3,
      recordedScore: 100,
      recordedPassed: true,
    });
    expect(screen.getByText("Đạt")).toBeTruthy();
  });

  it("after the last try the lock and its end are shown, and there is no 'Làm lại'", async () => {
    await submitted({
      attempts: attempts({
        remainingAttempts: 0,
        lockedUntil: "2026-11-05T12:00:00.000Z",
      }),
    });
    expect(screen.getByText(/nên bài trắc nghiệm tạm khóa/)).toBeTruthy();
    expect(screen.queryByText("Làm lại")).toBeNull();
  });

  it("'Làm lại' goes back to the rules, which are read again from the server", async () => {
    await submitted();
    quiz.mockResolvedValue(
      ok(
        quizInfo({
          attempts: attempts({ remainingAttempts: 1 }),
          recordedScore: 66.67,
          submittedAttemptCount: 1,
        }),
      ),
    );
    fireEvent.click(screen.getByText("Làm lại"));
    expect(await screen.findByText("Bắt đầu làm bài")).toBeTruthy();
    expect(screen.getByText("1/2")).toBeTruthy();
    expect(quiz).toHaveBeenCalledTimes(2);
  });

  it("the buttons lead to the history and to the list of the Course", async () => {
    await submitted();
    fireEvent.click(screen.getByText("Lịch sử làm bài"));
    expect(path).toBe("/learner/courses/enr-1/quizzes/quiz-1/history");
    cleanup();
    await submitted();
    fireEvent.click(screen.getByText("Về danh sách bài đánh giá"));
    expect(path).toBe("/learner/courses/enr-1/assessments");
  });
});

describe("the words of the glossary", () => {
  // bài trắc nghiệm, never bài kiểm tra; and no line of text in capitals (docs/frontend/ui-glossary-vi.md)
  const wordsOk = () => {
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/kiểm tra/i);
    expect(text).not.toMatch(/BÀI TRẮC|BÀI KIỂM|CÂU \d/);
    expect(document.body.textContent).toContain("Bài trắc nghiệm");
  };

  it("the rules, the attempt and the result say bài trắc nghiệm, and nothing is in capitals", async () => {
    open();
    await screen.findByText("Bắt đầu làm bài");
    wordsOk();
    fireEvent.click(screen.getByText("Bắt đầu làm bài"));
    await screen.findByText("Câu 1");
    wordsOk();
    submit.mockResolvedValue(ok(result()));
    fireEvent.click(screen.getByText("Nộp bài"));
    const buttons = await screen.findAllByText("Nộp bài");
    wordsOk();
    fireEvent.click(buttons[buttons.length - 1]);
    await screen.findByText("Kết quả bài trắc nghiệm");
    wordsOk();
  });

  it("a Quiz that cannot be opened or started says bài trắc nghiệm too", async () => {
    quiz.mockRejectedValue(new Error("down"));
    open();
    await screen.findByText("Thử lại");
    expect(document.body.textContent).not.toMatch(/kiểm tra/i);
    cleanup();
    quiz.mockResolvedValue(ok(quizInfo()));
    start.mockResolvedValue(refused("QUIZ_HAS_NO_QUESTIONS"));
    open();
    fireEvent.click(await screen.findByText("Bắt đầu làm bài"));
    expect(
      await screen.findByText(/Bài trắc nghiệm này chưa có câu hỏi nào/),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/kiểm tra/i);
  });
});

it("uses the generic Vietnamese message for an unknown quiz load error", async () => {
  quiz.mockResolvedValueOnce(refused("NEW_CODE"));
  open();
  await screen.findByText("Không thực hiện được thao tác. Vui lòng thử lại.");
  expect(screen.queryByText("English message from the server")).toBeNull();
});
