// @vitest-environment jsdom
// UC32.4: the Instructor filters the submissions of an Assignment. jsdom is for this file only.
import {
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
vi.mock("@/services/instructor.submission.service", () => ({
  getAssignmentSubmissionsAPI: vi.fn(),
}));

import { getAssignmentSubmissionsAPI } from "@/services/instructor.submission.service";
import Submissions from "./submissions";

const fetchList = vi.mocked(getAssignmentSubmissionsAPI);
const LEARNER = "00000000-0000-4000-8000-0000000000f0";

const item = (over: Record<string, unknown> = {}) => ({
  id: "s-1",
  learner: {
    id: LEARNER,
    fullName: "Nguyễn Văn A",
    email: "a@demo.local",
    status: "Active",
  },
  submissionNumber: 1,
  submittedAt: "2026-10-12T08:30:00Z",
  isLatest: true,
  gradingStatus: "AwaitingInstructor",
  interventionReason: "SCORE_GAP_EXCEEDED",
  finalScore: null,
  reviews: { completed: 2, total: 2 },
  ...over,
});
const answer = (items = [item()], over: Record<string, unknown> = {}) =>
  ({
    data: {
      assignment: {
        id: "a",
        courseId: "c",
        title: "Bài luận",
        peerReviewEnabled: true,
      },
      statusCounts: { AwaitingInstructor: 1, Finalized: 2 },
      learnerNamesAvailable: true,
      items,
      page: 1,
      pageSize: 20,
      total: items.length,
      ...over,
    },
  }) as never;

let search = "";
const Where = () => {
  search = useLocation().search;
  return null;
};
const open = (query = "") =>
  render(
    <MemoryRouter
      initialEntries={[`/instructor/submissions?assessmentId=a${query}`]}
    >
      <Routes>
        <Route
          path="/instructor/submissions"
          element={
            <>
              <Submissions />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
const lastQuery = () => fetchList.mock.calls.at(-1)![1];

beforeAll(() => {
  // antd reads these from the browser
  window.matchMedia ??= (() => ({
    matches: false,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as never;
});
beforeEach(() => {
  fetchList.mockReset();
  fetchList.mockResolvedValue(answer());
});
afterEach(cleanup);

describe("UC32.4 filtering the submissions", () => {
  it("shows the list in Vietnamese, with the reason of the intervention", async () => {
    open();
    expect(await screen.findByText("Nguyễn Văn A")).toBeTruthy();
    expect(screen.getAllByText("Chờ bạn chấm").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Điểm giữa các người chấm chênh lệch quá lớn"),
    ).toBeTruthy();
    expect(screen.getByText("Thời điểm nộp")).toBeTruthy();
    expect(screen.getByText(/12\/10\/2026/)).toBeTruthy();
    expect(
      screen.queryByText(/Submitted|Learner names|No submissions/),
    ).toBeNull();
  });

  it("asks for the filters that are in the address, and for nothing else", async () => {
    open(`&learnerId=${LEARNER}&needs=1&min=50&max=80&status=Finalized`);
    await screen.findByText("Nguyễn Văn A");
    expect(lastQuery()).toMatchObject({
      learnerId: LEARNER,
      needsIntervention: true,
      minScore: 50,
      maxScore: 80,
      status: "Finalized",
      latestOnly: true,
    });
    cleanup();
    open();
    await screen.findByText("Nguyễn Văn A");
    expect(lastQuery().needsIntervention).toBeUndefined();
    expect(lastQuery().minScore).toBeUndefined();
    expect(lastQuery().learnerId).toBeUndefined();
  });

  it("the switch 'Chỉ bài cần tôi chấm' filters, and goes back to page 1", async () => {
    open("&page=3");
    await screen.findByText("Nguyễn Văn A");
    fireEvent.click(screen.getAllByRole("switch")[0]);
    await waitFor(() => expect(lastQuery().needsIntervention).toBe(true));
    expect(search).toContain("needs=1");
    expect(search).not.toContain("page=");
  });

  it("filters by score when the button is pressed", async () => {
    open();
    await screen.findByText("Nguyễn Văn A");
    fireEvent.change(screen.getByLabelText("Điểm thấp nhất"), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByLabelText("Điểm cao nhất"), {
      target: { value: "90" },
    });
    fireEvent.click(screen.getByText("Lọc theo điểm"));
    await waitFor(() => expect(lastQuery().minScore).toBe(60));
    expect(lastQuery().maxScore).toBe(90);
    expect(search).toContain("min=60");
    expect(search).toContain("max=90");
  });

  it("does not ask the server when the lowest score is higher than the highest", async () => {
    open("&min=80&max=20");
    expect(
      await screen.findByText(/Điểm thấp nhất đang lớn hơn điểm cao nhất/),
    ).toBeTruthy();
    expect(fetchList).not.toHaveBeenCalled();
  });

  it("clears every filter at once", async () => {
    open("&needs=1&min=50&q=abc&status=Finalized");
    await screen.findByText("Nguyễn Văn A");
    fireEvent.click(screen.getByText("Xóa bộ lọc"));
    await waitFor(() => expect(lastQuery().needsIntervention).toBeUndefined());
    expect(lastQuery().q).toBeUndefined();
    expect(lastQuery().status).toBeUndefined();
    expect(search).not.toMatch(/needs|min=|q=|status/);
    expect(search).toContain("assessmentId=a");
  });

  it("says so when no submission matches, and shows the server's refusal in Vietnamese", async () => {
    fetchList.mockResolvedValue(answer([], { total: 0 }));
    open("&min=99");
    expect(
      await screen.findByText("Không có bài nộp nào khớp với bộ lọc."),
    ).toBeTruthy();
    cleanup();
    fetchList.mockRejectedValue(new Error("down"));
    open();
    expect(
      await screen.findByText("Không kết nối được với máy chủ."),
    ).toBeTruthy();
  });

  it("the tag of one Learner can be removed", async () => {
    open(`&learnerId=${LEARNER}`);
    expect(
      await screen.findByText(/Chỉ bài của một Learner: Nguyễn Văn A/),
    ).toBeTruthy();
    fireEvent.click(document.querySelector(".ant-tag-close-icon")!);
    await waitFor(() => expect(lastQuery().learnerId).toBeUndefined());
  });
});
