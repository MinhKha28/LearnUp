// @vitest-environment jsdom
// UC33.1 and the entry to UC33.2: the cycle the Instructor reads, by interaction. jsdom is for this file only.
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
vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  fetchPeerReviewCycleDetailAPI: vi.fn(),
}));

import * as api from "@/services/assessment.service";
import PeerCycleDetail from "./peer.cycle.detail";

const reviewer = (n: number, over: Record<string, unknown> = {}) => ({
  learnerId: `00000000-0000-4000-8000-00000000000${n}`,
  fullName: `Reviewer ${n}`,
  assigned: 2,
  completed: 0,
  obligation: "Missed",
  canWaive: true,
  ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  statusCode: 200,
  data: {
    assignmentId: "assignment-1",
    title: "Essay",
    cycle: {
      id: "cycle-1",
      opensAt: "2026-10-01T00:00:00Z",
      closesAt: "2026-10-08T00:00:00Z",
      reviewDueAt: "2026-10-11T00:00:00Z",
      reviewersPerSubmission: 2,
      scoreGap: 20,
      submissionCount: 3,
      status: "Assigned",
      closed: true,
    },
    submissions: [
      {
        id: "s1",
        learnerId: "00000000-0000-4000-8000-0000000000a1",
        fullName: "Author One",
        submittedAt: "2026-10-02T00:00:00Z",
        reviewsAssigned: 2,
        reviewsCompleted: 1,
        reviewsMissing: 1,
        lowestScore: null,
        highestScore: null,
        scoreGap: null,
        needsReview: false,
      },
      {
        id: "s2",
        learnerId: "00000000-0000-4000-8000-0000000000a2",
        fullName: "",
        submittedAt: "2026-10-03T00:00:00Z",
        reviewsAssigned: 2,
        reviewsCompleted: 2,
        reviewsMissing: 0,
        lowestScore: 60,
        highestScore: 90,
        scoreGap: 30,
        needsReview: true,
      },
    ],
    reviewers: [
      reviewer(1),
      reviewer(2, { obligation: "Satisfied", completed: 2, canWaive: false }),
      reviewer(3, { obligation: "Waived", canWaive: false }),
      reviewer(4, { obligation: "Pending", canWaive: false }),
    ],
    ...over,
  },
});

/** Shows where the router went, so the click on Waive can be checked without a second page. */
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const renderPage = () =>
  render(
    <MemoryRouter
      initialEntries={["/instructor/peer-cycles/assignment-1/cycle-1"]}
    >
      <Routes>
        <Route
          path="/instructor/peer-cycles/:assignmentId/:cycleId"
          element={<PeerCycleDetail />}
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList);
});
beforeEach(() => {
  vi.mocked(api.fetchPeerReviewCycleDetailAPI).mockResolvedValue(
    detail() as never,
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UC33.1 the detail of a cycle", () => {
  it("asks for the cycle of the Assignment in the address and shows the title and the three dates", async () => {
    renderPage();
    await screen.findByText("Essay");
    expect(api.fetchPeerReviewCycleDetailAPI).toHaveBeenCalledWith(
      "assignment-1",
      "cycle-1",
    );
    expect(screen.getByText("MỞ")).toBeTruthy();
    expect(screen.getByText("ĐÓNG VÀ PHÂN CÔNG")).toBeTruthy();
    expect(screen.getByText("HẠN CHẤM")).toBeTruthy();
  });

  it("shows the dates in the Vietnamese format whatever the language of the browser: day first, no AM or PM", async () => {
    // the machine that runs the test may already be Vietnamese, so the locale is also checked where it is chosen
    const format = vi.spyOn(Date.prototype, "toLocaleString");
    renderPage();
    await screen.findByText("Essay");
    expect(format).toHaveBeenCalledWith("vi-VN");
    format.mockRestore();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\b(AM|PM)\b/);
    expect(text).toMatch(/\d{1,2}\/\d{1,2}\/2026/);
  });

  it("lists the submissions with the reviews done, and a Learner the tenant does not know by the end of the id", async () => {
    renderPage();
    await screen.findByText("Author One");
    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByText("Học viên …00a2")).toBeTruthy();
  });

  it("shows the score gap of each submission and marks only the one above the threshold", async () => {
    renderPage();
    await screen.findByText("Author One");
    expect(screen.getByText("30")).toBeTruthy();
    expect(screen.getAllByText("Cần xem lại")).toHaveLength(1);
    expect(
      screen.getByText(
        "1 bài nộp có điểm của các người chấm chênh nhau hơn 20 điểm. Hãy xem lại và chốt điểm cuối (BR-252).",
      ),
    ).toBeTruthy();
  });

  it("writes the spread and the threshold with the Vietnamese decimal comma, and shows a missing spread as a dash", async () => {
    const base = detail();
    const [first, second] = base.data.submissions as object[];
    vi.mocked(api.fetchPeerReviewCycleDetailAPI).mockResolvedValue({
      ...base,
      data: {
        ...base.data,
        cycle: { ...base.data.cycle, scoreGap: 20.5 },
        submissions: [
          { ...second, scoreGap: 24.5, needsReview: true },
          { ...first, id: "submission-zero", scoreGap: 0, needsReview: false },
          { ...first, id: "submission-none", scoreGap: null, needsReview: false },
        ],
      },
    } as never);
    renderPage();
    await screen.findByText("24,5");
    expect(
      screen.getByText(
        "1 bài nộp có điểm của các người chấm chênh nhau hơn 20,5 điểm. Hãy xem lại và chốt điểm cuối (BR-252).",
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("24.5");
    expect(document.body.textContent).not.toContain("20.5");
    expect(screen.getAllByText("-")).toHaveLength(1); // only the submission without a spread
  });

  it("says nothing about the gap when no submission is above the threshold", async () => {
    const base = detail();
    vi.mocked(api.fetchPeerReviewCycleDetailAPI).mockResolvedValue({
      ...base,
      data: {
        ...base.data,
        submissions: base.data.submissions.map((s: object) => ({
          ...s,
          needsReview: false,
        })),
      },
    } as never);
    renderPage();
    await screen.findByText("Author One");
    expect(screen.queryByText("Cần xem lại")).toBeNull();
    expect(screen.queryByText(/chênh nhau hơn/)).toBeNull();
  });

  it("shows the state of each duty and offers Waive only on a Missed one", async () => {
    renderPage();
    await screen.findByText("Reviewer 1");
    expect(screen.getAllByText("Bỏ lỡ").length).toBeGreaterThan(0);
    expect(screen.getByText("Đã hoàn thành")).toBeTruthy();
    expect(screen.getByText("Đã miễn")).toBeTruthy();
    expect(screen.getByText("Đang thực hiện")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Miễn" })).toHaveLength(1);
  });

  it("goes to the waiver screen of that Learner when Waive is pressed", async () => {
    renderPage();
    await screen.findByText("Reviewer 1");
    fireEvent.click(screen.getByRole("button", { name: "Miễn" }));
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(
        "/instructor/peer-cycles/assignment-1/cycle-1/waive/00000000-0000-4000-8000-000000000001",
      ),
    );
  });

  it("says so when there is nobody to review or nothing submitted yet", async () => {
    vi.mocked(api.fetchPeerReviewCycleDetailAPI).mockResolvedValue(
      detail({ submissions: [], reviewers: [] }) as never,
    );
    renderPage();
    await screen.findByText("Chu kỳ này chưa có bài nộp.");
    expect(screen.getByText("Chưa phân công người chấm.")).toBeTruthy();
  });

  it.each([
    ["CYCLE_NOT_FOUND", "Chu kỳ chấm chéo này có thể đã bị xóa."],
    [
      "PEER_REVIEW_NOT_ENABLED",
      "Bài tập này chưa bật chấm chéo nên chưa có chu kỳ nào.",
    ],
  ])("explains %s instead of showing an empty page", async (code, text) => {
    vi.mocked(api.fetchPeerReviewCycleDetailAPI).mockResolvedValue({
      statusCode: 409,
      error: { code, message: "x" },
    } as never);
    renderPage();
    await screen.findByText(text);
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy();
  });

  it("says the service cannot be reached, and Try again asks again", async () => {
    vi.mocked(api.fetchPeerReviewCycleDetailAPI)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(detail() as never);
    renderPage();
    await screen.findByText(
      "Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Reviewer 1");
    expect(api.fetchPeerReviewCycleDetailAPI).toHaveBeenCalledTimes(2);
  });
});
