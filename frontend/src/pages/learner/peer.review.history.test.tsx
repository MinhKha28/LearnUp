// @vitest-environment jsdom
// UC31.2: the Learner reads the reviews they gave and where their duty stands. jsdom is for this file only.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
  fetchLearnerReviewHistoryAPI: vi.fn(),
}));

import * as api from "@/services/assessment.service";
import type {
  IReviewHistory,
  IReviewHistoryItem,
  IReviewObligation,
} from "@/types/assessment.types";
import PeerReviewHistory from "./peer.review.history";

const load = vi.mocked(api.fetchLearnerReviewHistoryAPI);
const ok = (data: unknown) => ({ statusCode: 200, data }) as never;

const obligation = (
  over: Partial<IReviewObligation> = {},
): IReviewObligation => ({
  assignmentId: "a-1",
  assignmentTitle: "Bài luận",
  courseId: "c-1",
  status: "Pending",
  requiredCount: 2,
  completedCount: 1,
  ...over,
});
const item = (over: Partial<IReviewHistoryItem> = {}): IReviewHistoryItem => ({
  id: "00000000-0000-4000-8000-0000000000ab",
  assignmentId: "a-1",
  assignmentTitle: "Bài luận",
  courseId: "c-1",
  score: 90,
  completedAt: "2026-11-05T23:45:00.000Z",
  comment: "Tốt",
  criteria: [
    { criterionId: "r1", name: "Nội dung", points: 55, maxPoints: 60 },
    { criterionId: "r2", name: "Trình bày", points: 35, maxPoints: 40 },
  ],
  ...over,
});
const history = (over: Partial<IReviewHistory> = {}): IReviewHistory => ({
  overall: "Pending",
  obligations: [obligation()],
  assignedCount: 2,
  completedCount: 1,
  total: 1,
  page: 1,
  pageSize: 20,
  items: [item()],
  ...over,
});

let path = "";
const Where = () => {
  path = useLocation().pathname;
  return null;
};
const open = () =>
  render(
    <MemoryRouter initialEntries={["/learner/peer-review/history"]}>
      <Routes>
        <Route
          path="/learner/peer-review/history"
          element={
            <>
              <PeerReviewHistory />
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
  load.mockReset();
  load.mockResolvedValue(ok(history()));
});
afterEach(cleanup);

describe("the history of the reviews", () => {
  it("shows the duty and each review with its score, the points of each criterion and the date, in Vietnamese", async () => {
    open();
    expect(await screen.findByText("Bài nộp 00AB")).toBeTruthy();
    expect(load).toHaveBeenCalledWith(1, 20, undefined);
    expect(screen.getByText("Lịch sử chấm của tôi")).toBeTruthy();
    expect(screen.getByText("Nghĩa vụ chấm chéo")).toBeTruthy();
    expect(screen.getAllByText("Đang thực hiện").length).toBeGreaterThan(0);
    expect(screen.getByText(/Số bài được giao: 2. Đã chấm: 1./)).toBeTruthy();
    expect(screen.getByText("Nội dung 55/60 · Trình bày 35/40")).toBeTruthy();
    expect(screen.getByText("06/11/2026 06:45")).toBeTruthy();
    for (const text of [
      "Bài nộp",
      "Bài tập",
      "Điểm đã chấm",
      "Ngày chấm",
      "Chi tiết",
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(document.body.textContent).not.toMatch(
      /Pending|Satisfied|Missed|Obligation|Completed|Score|Submission/,
    );
  });

  it("each Assignment shows its own count and state, the worst first as the server sends them", async () => {
    load.mockResolvedValue(
      ok(
        history({
          overall: "Missed",
          obligations: [
            obligation({
              assignmentId: "a-3",
              assignmentTitle: "Thực hành",
              status: "Missed",
              requiredCount: 1,
              completedCount: 0,
            }),
            obligation(),
            obligation({
              assignmentId: "a-2",
              assignmentTitle: "Báo cáo",
              status: "Satisfied",
              requiredCount: 2,
              completedCount: 2,
            }),
            obligation({
              assignmentId: "a-4",
              assignmentTitle: "Dự án",
              status: "Waived",
              requiredCount: 1,
              completedCount: 0,
            }),
          ],
        }),
      ),
    );
    open();
    await screen.findByText("Theo từng bài tập");
    const rows = Array.from(
      document.querySelectorAll(".peer-review-history-duties li"),
    ).map((li) => li.textContent ?? "");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain("Thực hành");
    expect(rows[0]).toContain("0/1 bài");
    expect(rows[0]).toContain("Chưa hoàn thành");
    expect(rows[1]).toContain("1/2 bài");
    expect(rows[2]).toContain("Báo cáo");
    expect(rows[2]).toContain("Hoàn thành");
    expect(rows[3]).toContain("Được miễn");
    // the whole duty is the worst of them
    const overall = within(
      document.querySelector(".peer-review-history-obligation") as HTMLElement,
    );
    expect(overall.getByText("Chưa hoàn thành")).toBeTruthy();
    expect(
      overall.getByText(/nộp lại bài để được giao chấm ở chu kỳ sau/),
    ).toBeTruthy();
    expect(overall.getByText(/nhờ giảng viên miễn nghĩa vụ/)).toBeTruthy();
  });

  it("a duty that is done says so", async () => {
    load.mockResolvedValue(
      ok(
        history({
          overall: "Satisfied",
          obligations: [obligation({ status: "Satisfied", completedCount: 2 })],
          completedCount: 2,
        }),
      ),
    );
    open();
    const overall = within(
      (await screen.findByText("Nghĩa vụ chấm chéo")).closest("div")!
        .parentElement as HTMLElement,
    );
    expect(overall.getByText("Hoàn thành")).toBeTruthy();
    expect(overall.getByText(/Bạn đã chấm đủ các bài được giao/)).toBeTruthy();
  });

  it("a Learner who was handed nothing: says so once, no Assignment list, no table row of reviews", async () => {
    load.mockResolvedValue(
      ok(
        history({
          overall: "NotApplicable",
          obligations: [],
          assignedCount: 0,
          completedCount: 0,
          total: 0,
          items: [],
        }),
      ),
    );
    open();
    expect(
      await screen.findByText("Chưa có bài chấm chéo nào hoàn thành."),
    ).toBeTruthy();
    expect(
      screen.getAllByText("Bạn chưa được giao bài chấm chéo nào."),
    ).toHaveLength(1);
    expect(screen.queryByText("Theo từng bài tập")).toBeNull();
    expect(screen.getByText("Không áp dụng")).toBeTruthy();
  });

  it("a score of 0 is shown as 0, not as empty", async () => {
    load.mockResolvedValue(ok(history({ items: [item({ score: 0 })] })));
    open();
    await screen.findByText("Bài nộp 00AB");
    const cell = document.querySelector(
      "tbody tr td:nth-child(3)",
    ) as HTMLElement;
    expect(cell.textContent).toMatch(/^0\/100/);
  });

  it("'Xem nhận xét' opens the review", async () => {
    open();
    fireEvent.click(await screen.findByText("Xem nhận xét"));
    expect(path).toBe(
      "/learner/peer-review/00000000-0000-4000-8000-0000000000ab",
    );
  });

  it("filters by Assignment when there are several, and goes back to the first page", async () => {
    load.mockResolvedValue(
      ok(
        history({
          total: 45,
          obligations: [
            obligation(),
            obligation({
              assignmentId: "a-2",
              assignmentTitle: "Báo cáo",
              status: "Satisfied",
            }),
          ],
        }),
      ),
    );
    open();
    await screen.findByText("Bài nộp 00AB");
    // on page 2 of the whole list first, so that going back to page 1 is something the filter has to do
    fireEvent.click(screen.getByTitle("2"));
    await waitFor(() =>
      expect(load).toHaveBeenLastCalledWith(2, 20, undefined),
    );
    const select = document.querySelector(
      ".ant-select-selector",
    ) as HTMLElement;
    fireEvent.mouseDown(select);
    fireEvent.click(await screen.findByTitle("Báo cáo"));
    await waitFor(() => expect(load).toHaveBeenLastCalledWith(1, 20, "a-2"));
  });

  it("with only one Assignment there is no filter to offer", async () => {
    open();
    await screen.findByText("Bài nộp 00AB");
    expect(screen.queryByLabelText("Lọc theo bài tập")).toBeNull();
  });

  it("pages when there are more reviews than a page", async () => {
    load.mockResolvedValue(ok(history({ total: 45 })));
    open();
    await screen.findByText("Bài nộp 00AB");
    fireEvent.click(screen.getByTitle("2"));
    await waitFor(() =>
      expect(load).toHaveBeenLastCalledWith(2, 20, undefined),
    );
  });

  it("no pager when everything fits one page", async () => {
    open();
    await screen.findByText("Bài nộp 00AB");
    expect(document.querySelector(".ant-pagination")).toBeNull();
  });

  it("an empty page for the Assignment asked says so for that Assignment", async () => {
    load.mockResolvedValueOnce(
      ok(
        history({
          obligations: [
            obligation(),
            obligation({ assignmentId: "a-2", assignmentTitle: "Báo cáo" }),
          ],
        }),
      ),
    );
    open();
    await screen.findByText("Bài nộp 00AB");
    load.mockResolvedValue(
      ok(
        history({
          total: 0,
          items: [],
          obligations: [
            obligation(),
            obligation({ assignmentId: "a-2", assignmentTitle: "Báo cáo" }),
          ],
        }),
      ),
    );
    fireEvent.mouseDown(
      document.querySelector(".ant-select-selector") as HTMLElement,
    );
    fireEvent.click(await screen.findByTitle("Báo cáo"));
    expect(
      await screen.findByText("Bạn chưa chấm bài nào của bài tập này."),
    ).toBeTruthy();
  });

  it("a refusal and a lost connection are told in Vietnamese and can be retried", async () => {
    load.mockResolvedValueOnce({
      statusCode: 403,
      error: { code: "FORBIDDEN", message: "English" },
    } as never);
    open();
    expect(
      await screen.findByText("Bạn không có quyền thực hiện thao tác này."),
    ).toBeTruthy();
    load.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("Thử lại"));
    expect(
      await screen.findByText(
        "Không kết nối được với máy chủ. Vui lòng thử lại.",
      ),
    ).toBeTruthy();
    load.mockResolvedValue(ok(history()));
    fireEvent.click(screen.getByText("Thử lại"));
    expect(await screen.findByText("Bài nộp 00AB")).toBeTruthy();
  });
});

it("uses its own Vietnamese message for an unknown review history error", async () => {
  load.mockResolvedValueOnce({
    statusCode: 400,
    error: { code: "NEW_CODE", message: "Internal English text" },
  } as never);
  open();
  await screen.findByText("Không tải được lịch sử chấm. Vui lòng thử lại.");
  expect(screen.queryByText("Internal English text")).toBeNull();
});
