// @vitest-environment jsdom
// UC32.2: the Instructor grades a submission with the Rubric, in Vietnamese. jsdom is for this file only.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { message } from "antd";
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
vi.mock("@/services/instructor.submission.service", () => ({
  getSubmissionDetailAPI: vi.fn(),
  gradeSubmissionAPI: vi.fn(),
}));

import {
  getSubmissionDetailAPI,
  gradeSubmissionAPI,
} from "@/services/instructor.submission.service";
import SubmissionGrade from "./submission.grade";

const fetchDetail = vi.mocked(getSubmissionDetailAPI);
const grade = vi.mocked(gradeSubmissionAPI);
const ok = (data: unknown) => ({ statusCode: 200, data }) as never;

const person = (id: string, fullName: string | null) => ({
  id,
  fullName,
  email: null,
  status: "Active",
});
const review = (id: string, score: number | null, status = "Completed") => ({
  id,
  reviewer: person(`rev-${id}`, `Người chấm ${id}`),
  reviewerRole: "Learner",
  status,
  score,
  comment: null,
  completedAt: null,
  scores: [],
});
const detail = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  learner: person("l1", "Nguyễn Văn A"),
  submissionNumber: 1,
  submittedAt: "2026-10-12T08:30:00.000Z",
  isLatest: true,
  content: "Bài làm của tôi",
  file: null,
  gradingStatus: "AwaitingInstructor",
  interventionReason: "SCORE_GAP_EXCEEDED",
  finalScore: null,
  finalizationComment: null,
  finalizedAt: null,
  assignment: {
    id: "a1",
    courseId: "c1",
    title: "Bài luận",
    prompt: null,
    promptFile: null,
    passingScore: 70,
    peerReviewEnabled: true,
    rubric: [
      {
        id: "r1",
        name: "Nội dung",
        description: "Đủ ý",
        maxPoints: 60,
        position: 1,
      },
      {
        id: "r2",
        name: "Trình bày",
        description: "",
        maxPoints: 40,
        position: 2,
      },
    ],
  },
  reviews: [review("a", 90), review("b", 50)],
  history: [],
  ...over,
});

let path = "";
const Where = () => {
  path = useLocation().pathname;
  return null;
};
const open = () =>
  render(
    <MemoryRouter initialEntries={["/instructor/submissions/s1/grade"]}>
      <Routes>
        <Route
          path="/instructor/submissions/:submissionId/grade"
          element={
            <>
              <SubmissionGrade />
              <Where />
            </>
          }
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
const inputs = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>(".ant-input-number-input"),
  );
const type = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });

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
  fetchDetail.mockReset();
  grade.mockReset();
  fetchDetail.mockResolvedValue(ok(detail()));
  vi.spyOn(message, "warning").mockImplementation((() => undefined) as never);
  vi.spyOn(message, "success").mockImplementation((() => undefined) as never);
  vi.spyOn(message, "error").mockImplementation((() => undefined) as never);
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("grading a submission", () => {
  it("is all in Vietnamese and explains why the Instructor grades", async () => {
    open();
    expect(await screen.findByText("Chấm bài của Nguyễn Văn A")).toBeTruthy();
    for (const text of [
      "Bài làm của học viên",
      "Vì sao bạn chấm bài này",
      "Chấm theo Rubric",
      "Tổng điểm Rubric",
      "Điểm bạn chấm",
      "Điểm cuối cùng gợi ý",
      "Sau khi chấm",
      "Gửi điểm",
      "Hủy",
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(
      screen.getByText(
        /Điểm của các người chấm chéo là 90, 50, chênh nhau 40 điểm/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Bài nộp chuyển sang "Chờ chốt điểm". Điểm cuối cùng chỉ được ghi nhận khi bạn chốt điểm.',
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /Submit grade|Cancel|Feedback|Rubric total|Suggested|Peer scores|pts|After grading/,
    );
  });

  it("the other reasons have their own guide in Vietnamese", async () => {
    fetchDetail.mockResolvedValue(
      ok(
        detail({
          interventionReason: "REVIEWER_MISSED_DEADLINE",
          reviews: [review("a", 80)],
        }),
      ),
    );
    open();
    expect(
      await screen.findByText(/thay cho lượt chấm chéo còn thiếu/),
    ).toBeTruthy();
    cleanup();
    fetchDetail.mockResolvedValue(
      ok(detail({ interventionReason: "PEER_REVIEW_DISABLED", reviews: [] })),
    );
    open();
    expect(
      await screen.findByText(/Chưa có lượt chấm chéo nào xong/),
    ).toBeTruthy();
    cleanup();
    fetchDetail.mockResolvedValue(
      ok(
        detail({
          interventionReason: "NOT_ENOUGH_SUBMISSIONS",
          reviews: [review("a", 70)],
        }),
      ),
    );
    open();
    expect(
      await screen.findByText(/lấy trung bình cùng các lượt chấm chéo đã xong/),
    ).toBeTruthy();
  });

  it("the score is worked out from the Rubric and the suggestion is averaged with the peer scores; the submit button waits for everything", async () => {
    fetchDetail.mockResolvedValue(
      ok(detail({ reviews: [review("a", 90), review("b", 60)] })),
    );
    open();
    await screen.findByText("Chấm bài của Nguyễn Văn A");
    const submit = () =>
      screen.getByText("Gửi điểm").closest("button") as HTMLButtonElement;
    expect(submit().disabled).toBe(true);
    const [first, second] = inputs();
    type(first, "30");
    type(second, "40");
    // 70 of 100 points; averaged with 90 and 60: (90 + 60 + 70) / 3 = 73.33
    expect(await screen.findByText("70 / 100 điểm")).toBeTruthy();
    expect(screen.getByText("70 / 100")).toBeTruthy();
    expect(screen.getByText("73.33 / 100")).toBeTruthy();
    expect(submit().disabled).toBe(true); // the comment is still missing
    fireEvent.change(
      screen.getByPlaceholderText("Nêu điểm mạnh và những điều cần cải thiện."),
      { target: { value: "Khá tốt" } },
    );
    await waitFor(() => expect(submit().disabled).toBe(false));
  });

  it("sends the points of every criterion and the comment, then goes back to the submission", async () => {
    grade.mockResolvedValue(ok({ suggestedScore: 70 }));
    open();
    await screen.findByText("Chấm bài của Nguyễn Văn A");
    const [first, second] = inputs();
    type(first, "30");
    type(second, "40");
    fireEvent.change(
      screen.getByPlaceholderText("Nêu điểm mạnh và những điều cần cải thiện."),
      { target: { value: "  Khá tốt  " } },
    );
    fireEvent.click(screen.getByText("Gửi điểm"));
    await waitFor(() => expect(grade).toHaveBeenCalledTimes(1));
    expect(grade).toHaveBeenCalledWith("s1", {
      scores: [
        { criterionId: "r1", points: 30 },
        { criterionId: "r2", points: 40 },
      ],
      comment: "Khá tốt",
    });
    await waitFor(() => expect(path).toBe("/instructor/submissions/s1"));
    expect(message.success).toHaveBeenCalledWith(
      "Đã chấm bài. Điểm cuối cùng gợi ý: 70 / 100.",
    );
  });

  it("a refusal of the server is shown, a lost connection too, in Vietnamese, and the page stays", async () => {
    open();
    await screen.findByText("Chấm bài của Nguyễn Văn A");
    const [first, second] = inputs();
    type(first, "30");
    type(second, "40");
    fireEvent.change(
      screen.getByPlaceholderText("Nêu điểm mạnh và những điều cần cải thiện."),
      { target: { value: "ok" } },
    );
    grade.mockResolvedValueOnce({
      statusCode: 409,
      message: "Máy chủ từ chối.",
    } as never);
    fireEvent.click(screen.getByText("Gửi điểm"));
    await waitFor(() =>
      expect(message.error).toHaveBeenCalledWith("Máy chủ từ chối."),
    );
    grade.mockResolvedValueOnce({ statusCode: 500 } as never);
    fireEvent.click(screen.getByText("Gửi điểm"));
    await waitFor(() =>
      expect(message.error).toHaveBeenCalledWith("Không lưu được điểm."),
    );
    grade.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("Gửi điểm"));
    await waitFor(() =>
      expect(message.error).toHaveBeenCalledWith(
        "Không kết nối được với máy chủ.",
      ),
    );
    expect(path).toBe("/instructor/submissions/s1/grade");
  });

  it("a submission that is not waiting for the Instructor cannot be graded and says why", async () => {
    fetchDetail.mockResolvedValue(
      ok(detail({ gradingStatus: "AwaitingFinalization" })),
    );
    open();
    expect(await screen.findByText(/nên không chờ bạn chấm/)).toBeTruthy();
    expect(
      screen.getByText(/Chờ chốt điểm/, { selector: ".ant-alert-message" }),
    ).toBeTruthy();
    expect(
      (screen.getByText("Gửi điểm").closest("button") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(inputs().every((input) => input.disabled)).toBe(true);
    fireEvent.click(screen.getByText("Xem bài nộp"));
    expect(path).toBe("/instructor/submissions/s1");
    cleanup();
    fetchDetail.mockResolvedValue(ok(detail({ isLatest: false })));
    open();
    expect(
      await screen.findByText(/Chỉ chấm được bài nộp mới nhất/),
    ).toBeTruthy();
  });

  it("'Hủy' goes back to the submission", async () => {
    open();
    fireEvent.click(await screen.findByText("Hủy"));
    expect(path).toBe("/instructor/submissions/s1");
  });

  it("a missing submission and a lost connection are told in Vietnamese", async () => {
    fetchDetail.mockResolvedValueOnce({ statusCode: 404 } as never);
    open();
    expect(await screen.findByText("Không tìm thấy bài nộp")).toBeTruthy();
    cleanup();
    fetchDetail.mockRejectedValueOnce(new Error("offline"));
    open();
    expect(
      await screen.findByText("Không kết nối được với máy chủ."),
    ).toBeTruthy();
  });
});
