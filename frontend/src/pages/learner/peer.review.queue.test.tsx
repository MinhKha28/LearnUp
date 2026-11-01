// @vitest-environment jsdom
// UC31: the reviews assigned to the Learner, by interaction. jsdom is for this file only.
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
  fetchLearnerPeerReviewsAPI: vi.fn(),
}));

import * as api from "@/services/assessment.service";
import PeerReviewQueue from "./peer.review.queue";

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  assignmentId: "assignment-1",
  assignmentTitle: "Essay",
  courseId: "course-1",
  status: "Pending",
  state: "Open",
  reviewDueAt: "2026-11-10T10:00:00Z",
  completedAt: null,
  score: null,
  ...over,
});
const list = (items: unknown[], pendingCount: number) => ({
  statusCode: 200,
  data: { pendingCount, items },
});

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/learner/peer-review"]}>
      <Routes>
        <Route path="/learner/peer-review" element={<PeerReviewQueue />} />
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
  vi.mocked(api.fetchLearnerPeerReviewsAPI).mockResolvedValue(
    list(
      [
        item("aaaa-0001"),
        item("bbbb-0002", {
          state: "Done",
          status: "Completed",
          completedAt: "2026-11-02T10:00:00Z",
          score: 80,
        }),
        item("cccc-0003", { state: "Closed", status: "Missed" }),
      ],
      1,
    ) as never,
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UC31 the queue of reviews", () => {
  it("says first how many reviews are to give, and lists each with its deadline and state", async () => {
    renderPage();
    await screen.findByText(/You have 1 review to give\./);
    expect(screen.getAllByText("Essay")).toHaveLength(3);
    expect(screen.getByText("To do")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText("Closed")).toBeTruthy();
  });

  it("names the work by the end of the id of the review and shows nothing of its author (BR-233)", async () => {
    renderPage();
    await screen.findByText("Submission 0001");
    expect(screen.getByText("Submission 0002")).toBeTruthy();
    expect(
      screen.getByText("Author names are hidden from Learner reviewers."),
    ).toBeTruthy();
  });

  it("offers the action that fits each state and goes to the review by its own id", async () => {
    renderPage();
    await screen.findByText("Submission 0001");
    expect(screen.getByRole("button", { name: "Start review" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View review" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(
        "/learner/peer-review/aaaa-0001",
      ),
    );
  });

  it("says there is nothing to give when every review is done", async () => {
    vi.mocked(api.fetchLearnerPeerReviewsAPI).mockResolvedValue(
      list([item("bbbb-0002", { state: "Done" })], 0) as never,
    );
    renderPage();
    await screen.findByText(/You have no review to give right now\./);
  });

  it("says so when no review is assigned", async () => {
    vi.mocked(api.fetchLearnerPeerReviewsAPI).mockResolvedValue(
      list([], 0) as never,
    );
    renderPage();
    await screen.findByText(
      "No Peer Review tasks are assigned to you right now.",
    );
  });

  it("shows the Vietnamese text of a Halted or Withdrawn Enrollment, and Try again asks again", async () => {
    vi.mocked(api.fetchLearnerPeerReviewsAPI)
      .mockResolvedValueOnce({
        statusCode: 409,
        error: { code: "ENROLLMENT_NOT_ACTIVE", message: "x" },
      } as never)
      .mockResolvedValue(list([], 0) as never);
    renderPage();
    await screen.findByText(/Khóa học đã tạm dừng/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText(
      "No Peer Review tasks are assigned to you right now.",
    );
    expect(api.fetchLearnerPeerReviewsAPI).toHaveBeenCalledTimes(2);
  });

  it("says the service cannot be reached", async () => {
    vi.mocked(api.fetchLearnerPeerReviewsAPI).mockRejectedValue(
      new Error("network"),
    );
    renderPage();
    await screen.findByText(
      /Unable to reach the Assessment service\. Please try again\./,
    );
  });
});
