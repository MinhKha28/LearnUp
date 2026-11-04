// @vitest-environment jsdom
// UC33.2: the Instructor confirms the waiver of one duty, by interaction. jsdom is for this file only.
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
vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  fetchPeerReviewCycleDetailAPI: vi.fn(),
  waivePeerReviewDutyAPI: vi.fn(),
}));

import * as api from "@/services/assessment.service";
import PeerCycleWaive from "./peer.cycle.waive";

const LEARNER = "00000000-0000-4000-8000-000000000001";
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
      submissionCount: 3,
      status: "Assigned",
      closed: true,
    },
    submissions: [],
    reviewers: [
      {
        learnerId: LEARNER,
        fullName: "Reviewer One",
        assigned: 2,
        completed: 0,
        obligation: "Missed",
        canWaive: true,
        ...over,
      },
    ],
  },
});
const waived = (over: Record<string, unknown> = {}) => ({
  statusCode: 200,
  data: {
    assignmentId: "assignment-1",
    learnerId: LEARNER,
    waivedAt: "2026-10-31T04:00:00Z",
    alreadyWaived: false,
    ...over,
  },
});

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const renderPage = (learner = LEARNER) =>
  render(
    <MemoryRouter
      initialEntries={[
        `/instructor/peer-cycles/assignment-1/cycle-1/waive/${learner}`,
      ]}
    >
      <Routes>
        <Route
          path="/instructor/peer-cycles/:assignmentId/:cycleId/waive/:learnerId"
          element={<PeerCycleWaive />}
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
  message.destroy();
  vi.clearAllMocks();
});

const backToCycle = "/instructor/peer-cycles/assignment-1/cycle-1";

describe("UC33.2 the waiver screen", () => {
  it("names the Learner and the Assignment, says what the Learner has done, and sends nothing until confirmed", async () => {
    renderPage();
    await screen.findByText("Học viên: Reviewer One");
    expect(screen.getByText("Bài tập: Essay")).toBeTruthy();
    expect(
      screen.getByText("Số bài đã chấm trong chu kỳ này: 0/2"),
    ).toBeTruthy();
    expect(screen.getByText(/BR-241/)).toBeTruthy();
    expect(api.waivePeerReviewDutyAPI).not.toHaveBeenCalled();
  });

  it("confirming waives that Learner on that Assignment, says the Learner was told, and goes back to the cycle", async () => {
    vi.mocked(api.waivePeerReviewDutyAPI).mockResolvedValue(waived() as never);
    renderPage();
    await screen.findByText("Học viên: Reviewer One");
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận miễn" }));
    await screen.findByText(
      "Đã miễn nghĩa vụ chấm chéo. Học viên đã được thông báo.",
    );
    expect(api.waivePeerReviewDutyAPI).toHaveBeenCalledWith(
      "assignment-1",
      LEARNER,
    );
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(backToCycle),
    );
  });

  it("a second press while it is saving sends one request only", async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.waivePeerReviewDutyAPI).mockReturnValue(
      new Promise((resolve) => (finish = resolve)) as never,
    );
    renderPage();
    await screen.findByText("Học viên: Reviewer One");
    const button = screen.getByRole("button", { name: "Xác nhận miễn" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api.waivePeerReviewDutyAPI).toHaveBeenCalledTimes(1);
    finish(waived());
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(backToCycle),
    );
  });

  it("a duty that was waived by someone else meanwhile says so and goes back", async () => {
    vi.mocked(api.waivePeerReviewDutyAPI).mockResolvedValue(
      waived({ alreadyWaived: true }) as never,
    );
    renderPage();
    await screen.findByText("Học viên: Reviewer One");
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận miễn" }));
    await screen.findByText("Nghĩa vụ này đã được miễn trước đó.");
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(backToCycle),
    );
  });

  it("a Learner who no longer owes anything gets a clear text, not a failure", async () => {
    vi.mocked(api.waivePeerReviewDutyAPI).mockResolvedValue({
      statusCode: 409,
      error: { code: "NOT_OWING_PEER_REVIEW", message: "x" },
    } as never);
    renderPage();
    await screen.findByText("Học viên: Reviewer One");
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận miễn" }));
    await screen.findByText(
      "Học viên này không còn nghĩa vụ chấm chéo nên không có gì để miễn.",
    );
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(backToCycle),
    );
  });

  it("another refusal shows the server's reason and stays on the screen", async () => {
    vi.mocked(api.waivePeerReviewDutyAPI).mockResolvedValue({
      statusCode: 404,
      error: { code: "ASSIGNMENT_NOT_FOUND", message: "Assignment not found." },
    } as never);
    renderPage();
    await screen.findByText("Học viên: Reviewer One");
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận miễn" }));
    await screen.findByText("Không tìm thấy bài tập.");
    expect(screen.getByRole("button", { name: "Xác nhận miễn" })).toBeTruthy();
    expect(screen.queryByTestId("where")).toBeNull();
  });

  it("when the service cannot be reached it says so and lets the Instructor try again", async () => {
    vi.mocked(api.waivePeerReviewDutyAPI).mockRejectedValue(
      new Error("network"),
    );
    renderPage();
    await screen.findByText("Học viên: Reviewer One");
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận miễn" }));
    await screen.findByText(
      "Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.",
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Xác nhận miễn",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
  });

  it.each([
    ["Waived", "Nghĩa vụ này đã được miễn."],
    [
      "Satisfied",
      "Học viên này hiện không có nghĩa vụ chấm chéo ở bài tập này (đã chấm xong hoặc vẫn còn hạn).",
    ],
  ])(
    "a %s duty has no confirm button: there is nothing to waive",
    async (obligation, text) => {
      vi.mocked(api.fetchPeerReviewCycleDetailAPI).mockResolvedValue(
        detail({ obligation, canWaive: false }) as never,
      );
      renderPage();
      await screen.findByText(text);
      expect(
        screen.queryByRole("button", { name: "Xác nhận miễn" }),
      ).toBeNull();
    },
  );

  it("a Learner who is not a reviewer of the cycle is not found", async () => {
    renderPage("00000000-0000-4000-8000-0000000000ff");
    await screen.findByText("Không tìm thấy người chấm");
    expect(screen.queryByRole("button", { name: "Xác nhận miễn" })).toBeNull();
  });
});
