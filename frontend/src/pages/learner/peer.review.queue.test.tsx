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
const list = (
  items: unknown[],
  pendingCount: number,
  over: Record<string, unknown> = {},
) => ({
  statusCode: 200,
  data: {
    pendingCount,
    total: items.length,
    page: 1,
    pageSize: 20,
    items,
    ...over,
  },
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
    await screen.findByText(/Bạn còn 1 bài cần chấm\./);
    expect(screen.getAllByText("Essay")).toHaveLength(3);
    expect(screen.getByText("Cần chấm")).toBeTruthy();
    expect(screen.getByText("Đã chấm")).toBeTruthy();
    expect(screen.getByText("Đã đóng")).toBeTruthy();
  });

  it("names the work by the end of the id of the review and shows nothing of its author (BR-233)", async () => {
    renderPage();
    await screen.findByText("Bài nộp 0001");
    expect(screen.getByText("Bài nộp 0002")).toBeTruthy();
    expect(
      screen.getByText("Tên tác giả được ẩn với người chấm là học viên."),
    ).toBeTruthy();
  });

  it("offers the action that fits each state and goes to the review by its own id", async () => {
    renderPage();
    await screen.findByText("Bài nộp 0001");
    expect(screen.getByRole("button", { name: "Bắt đầu chấm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xem nhận xét" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu chấm" }));
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(
        "/learner/peer-review/aaaa-0001",
      ),
    );
  });

  it("takes the number to give from the whole queue, not from the page it shows", async () => {
    vi.mocked(api.fetchLearnerPeerReviewsAPI).mockResolvedValue(
      list([item("aaaa-0001", { state: "Done", status: "Completed" })], 7, {
        total: 30,
        page: 2,
      }) as never,
    );
    renderPage();
    await screen.findByText(/Bạn còn 7 bài cần chấm/);
  });

  it("pages the queue: the control shows only when there is more than a page, and asks for the page that is chosen", async () => {
    vi.mocked(api.fetchLearnerPeerReviewsAPI)
      .mockResolvedValueOnce(
        list([item("aaaa-0001"), item("aaaa-0002")], 3, {
          total: 45,
          page: 1,
        }) as never,
      )
      .mockResolvedValueOnce(
        list([item("bbbb-0003", { assignmentTitle: "Second page" })], 3, {
          total: 45,
          page: 2,
        }) as never,
      );
    renderPage();
    await screen.findByText("Bài nộp 0001");
    expect(api.fetchLearnerPeerReviewsAPI).toHaveBeenLastCalledWith(1, 20);
    fireEvent.click(await screen.findByTitle("2"));
    await screen.findByText("Second page");
    expect(api.fetchLearnerPeerReviewsAPI).toHaveBeenLastCalledWith(2, 20);
    expect(screen.queryByText("Bài nộp 0001")).toBeNull();
  });

  it("shows no page control when everything fits on one page", async () => {
    renderPage();
    await screen.findByText(/Bạn còn/);
    expect(document.querySelector(".ant-pagination")).toBeNull();
  });

  it("says there is nothing to give when every review is done", async () => {
    vi.mocked(api.fetchLearnerPeerReviewsAPI).mockResolvedValue(
      list([item("bbbb-0002", { state: "Done" })], 0) as never,
    );
    renderPage();
    await screen.findByText(/Hiện bạn không có bài nào cần chấm\./);
  });

  it("says so when no review is assigned", async () => {
    vi.mocked(api.fetchLearnerPeerReviewsAPI).mockResolvedValue(
      list([], 0) as never,
    );
    renderPage();
    await screen.findByText(
      "Hiện chưa có nhiệm vụ chấm chéo nào được giao cho bạn.",
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
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText(
      "Hiện chưa có nhiệm vụ chấm chéo nào được giao cho bạn.",
    );
    expect(api.fetchLearnerPeerReviewsAPI).toHaveBeenCalledTimes(2);
  });

  it("says the service cannot be reached", async () => {
    vi.mocked(api.fetchLearnerPeerReviewsAPI).mockRejectedValue(
      new Error("network"),
    );
    renderPage();
    await screen.findByText(
      /Không kết nối được dịch vụ Đánh giá\. Vui lòng thử lại\./,
    );
  });
});
