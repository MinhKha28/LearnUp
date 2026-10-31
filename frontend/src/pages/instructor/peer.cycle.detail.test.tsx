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
      },
      {
        id: "s2",
        learnerId: "00000000-0000-4000-8000-0000000000a2",
        fullName: "",
        submittedAt: "2026-10-03T00:00:00Z",
        reviewsAssigned: 2,
        reviewsCompleted: 2,
        reviewsMissing: 0,
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
    expect(screen.getByText("OPEN")).toBeTruthy();
    expect(screen.getByText("CLOSE & ASSIGN")).toBeTruthy();
    expect(screen.getByText("REVIEW DEADLINE")).toBeTruthy();
  });

  it("lists the submissions with the reviews done, and a Learner the tenant does not know by the end of the id", async () => {
    renderPage();
    await screen.findByText("Author One");
    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByText("Learner …00a2")).toBeTruthy();
  });

  it("shows the state of each duty and offers Waive only on a Missed one", async () => {
    renderPage();
    await screen.findByText("Reviewer 1");
    expect(screen.getAllByText("Missed").length).toBeGreaterThan(0);
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Waived")).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Waive" })).toHaveLength(1);
  });

  it("goes to the waiver screen of that Learner when Waive is pressed", async () => {
    renderPage();
    await screen.findByText("Reviewer 1");
    fireEvent.click(screen.getByRole("button", { name: "Waive" }));
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
    await screen.findByText("No Submissions in this Cycle yet.");
    expect(screen.getByText("No Reviewers assigned yet.")).toBeTruthy();
  });

  it.each([
    ["CYCLE_NOT_FOUND", "This Peer Review Cycle may have been removed."],
    [
      "PEER_REVIEW_NOT_ENABLED",
      "Peer Review is not enabled for this Assignment, so it has no cycles.",
    ],
  ])("explains %s instead of showing an empty page", async (code, text) => {
    vi.mocked(api.fetchPeerReviewCycleDetailAPI).mockResolvedValue({
      statusCode: 409,
      error: { code, message: "x" },
    } as never);
    renderPage();
    await screen.findByText(text);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("says the service cannot be reached, and Try again asks again", async () => {
    vi.mocked(api.fetchPeerReviewCycleDetailAPI)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(detail() as never);
    renderPage();
    await screen.findByText(
      "Unable to reach the Assessment service. Please try again.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Reviewer 1");
    expect(api.fetchPeerReviewCycleDetailAPI).toHaveBeenCalledTimes(2);
  });
});
