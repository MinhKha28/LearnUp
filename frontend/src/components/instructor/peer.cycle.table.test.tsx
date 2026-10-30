// @vitest-environment jsdom
// UC33, the "Đóng chu kỳ" action of the Instructor, by interaction. jsdom is for this file only; the other suites keep node.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { message } from "antd";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/axios.customize", () => ({ assessmentAxios: {}, default: {} }));
vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  fetchPeerReviewCyclesAPI: vi.fn(),
  closePeerReviewCycleAPI: vi.fn(),
}));

import * as api from "@/services/assessment.service";
import PeerCycleTable from "./peer.cycle.table";

const HOUR = 3_600_000;
// The closing line is read against the clock of the browser, so the dates are made from now.
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const cycle = (n: number, over: Record<string, unknown> = {}) => ({
  id: `cycle-${n}`,
  opensAt: ago(24 * 8),
  closesAt: ago(1),
  reviewDueAt: "2026-10-11T00:00:00Z",
  submissionCount: 7,
  status: "Open",
  closed: false,
  ...over,
});
const list = (items: unknown[]) => ({
  statusCode: 200,
  data: {
    assignmentId: "a1",
    title: "Essay",
    settings: { reviewersPerSubmission: 2, cycleDays: 7, deadlineDays: 3, scoreGap: 20 },
    items,
  },
});
const closed = (over: Record<string, unknown> = {}) => ({
  statusCode: 200,
  data: {
    cycleId: "cycle-2",
    status: "Assigned",
    submissionCount: 7,
    reviewCount: 14,
    closedAt: "2026-10-25T10:00:00Z",
    alreadyClosed: false,
    ...over,
  },
});

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as unknown as MediaQueryList);
});
beforeEach(() => {
  // Cycle 1 is already closed, Cycle 2 is open and its closing line has passed
  vi.mocked(api.fetchPeerReviewCyclesAPI).mockResolvedValue(
    list([cycle(1, { status: "Completed", closed: true }), cycle(2)]) as never,
  );
});
afterEach(() => {
  cleanup();
  message.destroy(); // antd keeps one holder of messages; clear the messages, never the holder
  vi.clearAllMocks();
});

const closeButtons = () => screen.queryAllByRole("button", { name: "Đóng chu kỳ" });
const confirmClosing = async () => {
  fireEvent.click(closeButtons()[0]);
  const ok = await waitFor(() => {
    const button = document.querySelector(".ant-popconfirm .ant-btn-primary");
    if (!button) throw new Error("the confirmation is not open yet");
    return button as HTMLElement;
  });
  fireEvent.click(ok);
};

describe("the Đóng chu kỳ action", () => {
  it("is offered only on a cycle that is still open and past its closing line", async () => {
    render(<PeerCycleTable assignmentId="a1" />);
    await screen.findByText("Cycle 2");
    expect(closeButtons()).toHaveLength(1);
  });

  it("is not offered on an open cycle that has not reached its closing line: the calendar closes it (BR-230)", async () => {
    vi.mocked(api.fetchPeerReviewCyclesAPI).mockResolvedValue(
      list([cycle(1, { status: "Completed", closed: true }), cycle(2, { closesAt: ago(-5) })]) as never,
    );
    render(<PeerCycleTable assignmentId="a1" />);
    await screen.findByText("Cycle 2");
    expect(closeButtons()).toHaveLength(0);
  });

  it("asks first, and sends nothing until the Instructor confirms", async () => {
    render(<PeerCycleTable assignmentId="a1" />);
    await screen.findByText("Cycle 2");
    fireEvent.click(closeButtons()[0]);
    await screen.findByText("Đóng chu kỳ này ngay bây giờ?");
    expect(
      screen.getByText(/Chu kỳ 2 đã qua giờ chốt và lịch chưa đóng nó\. Đóng chu kỳ sẽ phân 7 bài nộp để người học chấm chéo/),
    ).toBeTruthy();
    expect(api.closePeerReviewCycleAPI).not.toHaveBeenCalled();
  });

  it("closes the chosen cycle, says how many reviews went to how many Learners, and reloads the table", async () => {
    vi.mocked(api.closePeerReviewCycleAPI).mockResolvedValue(closed() as never);
    render(<PeerCycleTable assignmentId="a1" />);
    await screen.findByText("Cycle 2");
    await confirmClosing();
    await screen.findByText("Cycle closed. 14 reviews were handed out to 7 Learners.");
    expect(api.closePeerReviewCycleAPI).toHaveBeenCalledWith("a1", "cycle-2");
    await waitFor(() => expect(api.fetchPeerReviewCyclesAPI).toHaveBeenCalledTimes(2));
  });

  it("with too few submissions it says the Instructor grades them all", async () => {
    vi.mocked(api.closePeerReviewCycleAPI).mockResolvedValue(
      closed({ status: "InstructorOnly", submissionCount: 2, reviewCount: 0 }) as never,
    );
    render(<PeerCycleTable assignmentId="a1" />);
    await screen.findByText("Cycle 2");
    await confirmClosing();
    await screen.findByText("Cycle closed. Only 2 submissions, so you grade them all.");
  });

  it("a cycle that someone else closed first says so, and nothing is promised twice", async () => {
    vi.mocked(api.closePeerReviewCycleAPI).mockResolvedValue(closed({ alreadyClosed: true }) as never);
    render(<PeerCycleTable assignmentId="a1" />);
    await screen.findByText("Cycle 2");
    await confirmClosing();
    await screen.findByText("This cycle was already closed.");
    expect(screen.queryByText(/reviews were handed out/)).toBeNull();
  });

  it("shows the server's reason when the closing is refused, and does not reload as if it worked", async () => {
    vi.mocked(api.closePeerReviewCycleAPI).mockResolvedValue({
      statusCode: 409,
      error: { code: "CYCLE_NOT_DUE", message: "This cycle has not reached its closing time yet." },
    } as never);
    render(<PeerCycleTable assignmentId="a1" />);
    await screen.findByText("Cycle 2");
    await confirmClosing();
    await screen.findByText("This cycle has not reached its closing time yet.");
    expect(api.fetchPeerReviewCyclesAPI).toHaveBeenCalledTimes(1);
  });

  it("tells the Instructor when the Assessment service cannot be reached", async () => {
    vi.mocked(api.closePeerReviewCycleAPI).mockRejectedValue(new Error("network"));
    render(<PeerCycleTable assignmentId="a1" />);
    await screen.findByText("Cycle 2");
    await confirmClosing();
    await screen.findByText("Unable to reach the Assessment service. Please try again.");
  });
});
