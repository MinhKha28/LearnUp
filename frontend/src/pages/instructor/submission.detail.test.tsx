// @vitest-environment jsdom
// UC32 / UC32.1: the Instructor reads one submission, in Vietnamese. jsdom is for this file only.
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
vi.mock("@/services/instructor.submission.service", () => ({
  getSubmissionDetailAPI: vi.fn(),
  gradeSubmissionAPI: vi.fn(),
}));

import { getSubmissionDetailAPI } from "@/services/instructor.submission.service";
import SubmissionDetail from "./submission.detail";

const fetchDetail = vi.mocked(getSubmissionDetailAPI);
const ok = (data: unknown) => ({ statusCode: 200, data }) as never;

const person = (id: string, fullName: string | null) => ({
  id,
  fullName,
  email: `${id}@demo.local`,
  status: "Active",
});
const detail = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  learner: person("l1", "Nguyễn Văn A"),
  submissionNumber: 2,
  submittedAt: "2026-10-12T08:30:00.000Z",
  isLatest: true,
  content: "Bài làm của tôi",
  file: {
    fileName: "bai-lam.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    url: "https://files/x",
  },
  gradingStatus: "AwaitingInstructor",
  interventionReason: "SCORE_GAP_EXCEEDED",
  finalScore: null,
  finalizationComment: null,
  finalizedAt: null,
  assignment: {
    id: "a1",
    courseId: "c1",
    title: "Bài luận an toàn",
    prompt: "Viết về an toàn lao động",
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
  reviews: [
    {
      id: "v1",
      reviewer: person("l2", "Trần Thị B"),
      reviewerRole: "Learner",
      status: "Completed",
      score: 80,
      comment: "Khá tốt",
      completedAt: "2026-10-14T00:00:00.000Z",
      scores: [
        { criterionId: "r1", points: 50 },
        { criterionId: "r2", points: 30 },
      ],
    },
    {
      id: "v2",
      reviewer: person("l3", null),
      reviewerRole: "Learner",
      status: "Missed",
      score: null,
      comment: null,
      completedAt: null,
      scores: [],
    },
    {
      id: "v3",
      reviewer: person("i1", "Giảng viên C"),
      reviewerRole: "Instructor",
      status: "Pending",
      score: null,
      comment: null,
      completedAt: null,
      scores: [],
    },
  ],
  history: [
    {
      id: "s2",
      submissionNumber: 2,
      submittedAt: "2026-10-12T08:30:00.000Z",
      gradingStatus: "AwaitingInstructor",
      finalScore: null,
    },
    {
      id: "s1",
      submissionNumber: 1,
      submittedAt: "2026-10-10T08:30:00.000Z",
      gradingStatus: "Finalized",
      finalScore: 55,
    },
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
    <MemoryRouter initialEntries={["/instructor/submissions/s1"]}>
      <Routes>
        <Route
          path="/instructor/submissions/:submissionId"
          element={
            <>
              <SubmissionDetail />
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
  fetchDetail.mockReset();
  fetchDetail.mockResolvedValue(ok(detail()));
});
afterEach(cleanup);

describe("the detail of a submission", () => {
  it("is all in Vietnamese: sections, status, reason, reviews, rubric and history", async () => {
    open();
    expect(await screen.findByText("Nguyễn Văn A")).toBeTruthy();
    for (const text of [
      "Bài làm của học viên",
      "Các lượt chấm",
      "Lịch sử nộp bài",
      "Danh tính hiển thị",
      "Chấm bài nộp",
      "Chờ bạn chấm",
      "Điểm giữa các người chấm chênh lệch quá lớn",
      "Điểm đạt: 70 / 100",
      "Tổng",
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/Nộp lúc/)).toBeTruthy();
    expect(screen.getByText("Bài luận an toàn / Lần nộp #2")).toBeTruthy();
    expect(screen.getByText("60 điểm")).toBeTruthy();
    expect(screen.getByText("100 điểm")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /Submitted|Reviews|Learner work|Attempt|pts|Grade submission|Submission history|No reviews|visible to the Instructor|Passing score|Total/,
    );
  });

  it("names the role and the state of each review in Vietnamese", async () => {
    open();
    await screen.findByText("Trần Thị B");
    expect(screen.getAllByText("Học viên").length).toBe(2);
    expect(screen.getByText("Giảng viên")).toBeTruthy();
    expect(screen.getByText("Đã chấm")).toBeTruthy();
    expect(screen.getByText("Bỏ lỡ")).toBeTruthy();
    expect(screen.getByText("Chưa chấm")).toBeTruthy();
    expect(screen.getByText("Khá tốt")).toBeTruthy();
    expect(screen.getByText("50 / 60")).toBeTruthy();
    expect(screen.getByText("30 / 40")).toBeTruthy();
    // a reviewer whose name is unknown still has a label
    expect(screen.getByText(/^Learner [0-9A-Z]{2,4}$/)).toBeTruthy();
  });

  it("says when there is no written answer, no prompt text or no review", async () => {
    fetchDetail.mockResolvedValue(
      ok(
        detail({
          content: null,
          file: null,
          reviews: [],
          assignment: { ...detail().assignment, prompt: null },
        }),
      ),
    );
    open();
    expect(
      await screen.findByText("Không có bài làm dạng văn bản."),
    ).toBeTruthy();
    expect(screen.getByText("Chưa có lượt chấm nào.")).toBeTruthy();
    expect(screen.getByText("Đề bài không có phần văn bản.")).toBeTruthy();
  });

  it("the attached file is named in Vietnamese when it has no name", async () => {
    fetchDetail.mockResolvedValue(
      ok(
        detail({
          file: { fileName: null, mimeType: null, sizeBytes: null, url: null },
        }),
      ),
    );
    open();
    expect(await screen.findByText("Tệp đính kèm")).toBeTruthy();
  });

  it("the grade button is there only for the latest submission waiting for the Instructor, and leads to the grading page", async () => {
    open();
    fireEvent.click(await screen.findByText("Chấm bài nộp"));
    expect(path).toBe("/instructor/submissions/s1/grade");
    cleanup();
    fetchDetail.mockResolvedValue(
      ok(
        detail({
          gradingStatus: "Finalized",
          finalScore: 85,
          finalizationComment: "Tốt",
        }),
      ),
    );
    open();
    await screen.findByText("Điểm cuối cùng");
    expect(screen.queryByText("Chấm bài nộp")).toBeNull();
    expect(screen.getByText("85")).toBeTruthy();
    expect(screen.getByText("Tốt")).toBeTruthy();
  });

  it.each([
    ["AwaitingFinalization", true, true],
    ["AwaitingFinalization", false, false],
    ["AwaitingInstructor", true, false],
    ["Finalized", true, false],
  ])("shows the finalize link for status %s and latest=%s only when eligible", async (gradingStatus, isLatest, visible) => {
    fetchDetail.mockResolvedValue(ok(detail({ gradingStatus, isLatest })));
    open();
    await screen.findByText("Nguyễn Văn A");
    const link = screen.queryByRole("link", { name: "Chốt điểm" });
    if (visible) expect(link?.getAttribute("href")).toBe("/instructor/submissions/s1/finalize");
    else expect(link).toBeNull();
  });

  it("a replaced submission says so and cannot be graded", async () => {
    fetchDetail.mockResolvedValue(ok(detail({ isLatest: false })));
    open();
    expect(
      await screen.findByText(/đã được thay bằng một bài mới hơn/),
    ).toBeTruthy();
    expect(screen.queryByText("Chấm bài nộp")).toBeNull();
  });

  it("another submission of the history can be opened", async () => {
    open();
    await screen.findByText("Lịch sử nộp bài");
    fireEvent.click(screen.getByText("#1"));
    expect(path).toBe("/instructor/submissions/s2".replace("s2", "s1"));
  });

  it("a missing submission and a lost connection are told in Vietnamese, with the way back", async () => {
    fetchDetail.mockResolvedValueOnce({
      statusCode: 404,
      error: { code: "SUBMISSION_NOT_FOUND" },
    } as never);
    open();
    expect(await screen.findByText("Không tìm thấy bài nộp")).toBeTruthy();
    expect(
      screen.getByText(
        "Không tìm thấy bài nộp này, hoặc bạn không phụ trách chấm bài này.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Về Khóa học của tôi"));
    expect(path).toBe("/instructor/courses");
    cleanup();
    fetchDetail.mockRejectedValueOnce(new Error("offline"));
    open();
    expect(
      await screen.findByText("Không kết nối được với máy chủ."),
    ).toBeTruthy();
  });
});
