// @vitest-environment jsdom
// UC32.4: the Instructor filters the submissions of an Assignment. jsdom is for this file only.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
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
let goTo: (to: string) => void = () => undefined;
const Where = () => {
  search = useLocation().search;
  goTo = useNavigate();
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
        <Route
          path="/instructor/submissions/:id"
          element={<div>Trang chi tiết bài nộp</div>}
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
      await screen.findByText(/Chỉ bài của một học viên: Nguyễn Văn A/),
    ).toBeTruthy();
    fireEvent.click(document.querySelector(".ant-tag-close-icon")!);
    await waitFor(() => expect(lastQuery().learnerId).toBeUndefined());
  });

  it("the name of the Learner in a row filters the list to that Learner and does not open the submission", async () => {
    open();
    fireEvent.click(await screen.findByTitle("Chỉ xem bài của học viên này"));
    await waitFor(() => expect(lastQuery().learnerId).toBe(LEARNER));
    expect(search).toContain(`learnerId=${LEARNER}`);
    expect(screen.queryByText("Trang chi tiết bài nộp")).toBeNull();
    // the name is known from the row that was clicked
    expect(
      await screen.findByText(/Chỉ bài của một học viên: Nguyễn Văn A/),
    ).toBeTruthy();
  });

  it("a row opens its submission with a click, with Enter and with Space", async () => {
    for (const open_ of [
      (row: Element) => fireEvent.click(row),
      (row: Element) => fireEvent.keyDown(row, { key: "Enter" }),
      (row: Element) => fireEvent.keyDown(row, { key: " " }),
    ]) {
      open();
      await screen.findByText("Nguyễn Văn A");
      open_(document.querySelector('[role="link"]')!);
      expect(await screen.findByText("Trang chi tiết bài nộp")).toBeTruthy();
      cleanup();
    }
  });

  it("Enter on the name of the Learner filters; it does not also open the submission", async () => {
    open();
    const name = await screen.findByTitle("Chỉ xem bài của học viên này");
    // a key pressed on the button reaches the row too, and only the row itself reacts to keys
    fireEvent.keyDown(name, { key: "Enter", bubbles: true });
    expect(screen.queryByText("Trang chi tiết bài nộp")).toBeNull();
  });

  it("the tag keeps the name of the Learner when the other filters leave no row", async () => {
    open(`&learnerId=${LEARNER}`);
    await screen.findByText(/Chỉ bài của một học viên: Nguyễn Văn A/);
    fetchList.mockResolvedValue(answer([], { total: 0 }));
    fireEvent.click(screen.getAllByRole("switch")[0]);
    expect(
      await screen.findByText("Không có bài nộp nào khớp với bộ lọc."),
    ).toBeTruthy();
    expect(
      screen.getByText(/Chỉ bài của một học viên: Nguyễn Văn A/),
    ).toBeTruthy();
  });

  it("the tag names the Learner by the end of the id when no row has ever shown the name", async () => {
    fetchList.mockResolvedValue(answer([], { total: 0 }));
    open(`&learnerId=${LEARNER}&min=99`);
    expect(
      await screen.findByText(/Chỉ bài của một học viên: Học viên 00F0/),
    ).toBeTruthy();
  });

  it("the tag does not keep the name of another Learner after the filter changes", async () => {
    const OTHER = "00000000-0000-4000-8000-0000000000f1";
    open(`&learnerId=${LEARNER}`);
    await screen.findByText(/Chỉ bài của một học viên: Nguyễn Văn A/);
    // the address changes inside the same page (back or forward in the history) to another Learner, who has no row
    fetchList.mockResolvedValue(answer([], { total: 0 }));
    act(() =>
      goTo(`/instructor/submissions?assessmentId=a&learnerId=${OTHER}`),
    );
    expect(
      await screen.findByText(/Chỉ bài của một học viên: Học viên 00F1/),
    ).toBeTruthy();
  });

  it("a score is 0 to 100: the boxes stop at 100 and a value outside it in the address is not a filter", async () => {
    open("&min=-5&max=150");
    await screen.findByText("Nguyễn Văn A");
    expect(lastQuery().minScore).toBeUndefined();
    expect(lastQuery().maxScore).toBeUndefined();
    expect(
      screen.getByLabelText("Điểm thấp nhất").getAttribute("aria-valuemax"),
    ).toBe("100");
    expect(
      screen.getByLabelText("Điểm cao nhất").getAttribute("aria-valuemax"),
    ).toBe("100");
    cleanup();
    open("&min=0&max=100");
    await screen.findByText("Nguyễn Văn A");
    expect(lastQuery()).toMatchObject({ minScore: 0, maxScore: 100 });
  });
});
