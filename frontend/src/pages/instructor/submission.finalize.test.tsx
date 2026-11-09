// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/instructor.submission.service", () => ({
  getSubmissionDetailAPI: vi.fn(),
  finalizeSubmissionAPI: vi.fn(),
}));

vi.mock("@/services/axios.customize", () => ({
  assessmentAxios: {},
  default: {},
}));

import { finalizeSubmissionAPI, getSubmissionDetailAPI } from "@/services/instructor.submission.service";
import type { ISubmissionDetail } from "@/types/submission.types";
import SubmissionDetail from "./submission.detail";
import SubmissionDiscrepancy from "./submission.discrepancy";
import SubmissionFinalize from "./submission.finalize";

const fetchDetail = vi.mocked(getSubmissionDetailAPI);
const publish = vi.mocked(finalizeSubmissionAPI);
const ok = (data: unknown) => ({ statusCode: 200, data }) as never;
const failure = (statusCode: number, code: string) =>
  ({ statusCode, error: { code } }) as never;

const submission = (overrides: Partial<ISubmissionDetail> = {}): ISubmissionDetail => ({
  id: "sub-riley-park",
  learner: { id: "learner", fullName: "Nguyễn Văn A", email: null, status: null },
  submissionNumber: 1,
  submittedAt: "2026-10-12T08:30:00.000Z",
  gradingStatus: "AwaitingFinalization",
  isLatest: true,
  aggregateScore: 70.29,
  content: null,
  file: null,
  finalScore: null,
  interventionReason: null,
  finalizationComment: null,
  finalizedAt: null,
  assignment: {
    id: "a", courseId: "c", title: "Bài luận", prompt: null, promptFile: null,
    passingScore: 70, peerReviewEnabled: false, rubric: [],
  },
  history: [],
  reviews: [{
    id: "r", reviewer: { id: "i", fullName: "Giảng viên B", email: null, status: null },
    reviewerRole: "Instructor", status: "Completed", score: 70.29,
    comment: "Nhận xét lượt chấm", completedAt: "2026-10-12T08:30:00.000Z", scores: [],
  }],
  ...overrides,
});

let path = "";
const Where = () => {
  path = useLocation().pathname;
  return null;
};
const open = (page: "finalize" | "discrepancy", id = "sub-riley-park") =>
  render(
    <MemoryRouter initialEntries={[`/instructor/submissions/${id}/${page}`]}>
      <Routes>
        <Route
          path="/instructor/submissions/:submissionId/finalize"
          element={
            <>
              <SubmissionFinalize />
              <Where />
            </>
          }
        />
        <Route
          path="/instructor/submissions/:submissionId/discrepancy"
          element={
            <>
              <SubmissionDiscrepancy />
              <Where />
            </>
          }
        />
        <Route
          path="/instructor/submissions/:submissionId"
          element={<><SubmissionDetail /><Where /></>}
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
  fetchDetail.mockReset().mockResolvedValue(ok(submission()));
  publish.mockReset().mockResolvedValue(ok({ gradingStatus: "Finalized" }));
});
afterEach(cleanup);

const ENGLISH =
  /Finalize|Publish|Feedback|Minimum passing|Peer Review aggregate|\[|Reviewer:|Rubric criterion|Difference|Back to|not found|may have been removed|Instructor review required|Criterion/;

describe("UC32.3 finalizing a score", () => {
  const required =
    "Điểm cuối cùng khác điểm tổng hợp, vui lòng nhập nhận xét giải thích.";
  const fields = async () => ({
    score: (await screen.findByLabelText("Điểm cuối cùng")) as HTMLInputElement,
    comment: screen.getByLabelText("Nhận xét cho học viên") as HTMLTextAreaElement,
  });
  const openConfirmation = async (label = "Công bố điểm cuối cùng") => {
    fireEvent.click(screen.getByRole("button", { name: label }));
    return within(await screen.findByRole("dialog"));
  };

  it("prefills the API aggregate and displays the learner and reviews", async () => {
    open("finalize");
    expect((await fields()).score.value).toBe("70.29");
    expect(screen.getByText("Điểm tổng hợp").nextElementSibling?.textContent).toBe("70.29/100");
    expect(screen.getByText("Học viên: Nguyễn Văn A")).toBeTruthy();
    expect(screen.getByText("Giảng viên B")).toBeTruthy();
    expect(screen.getByText("Nhận xét lượt chấm")).toBeTruthy();
  });

  it("requires a trimmed explanation for a one-hundredth change", async () => {
    open("finalize");
    const { score, comment } = await fields();
    fireEvent.change(score, { target: { value: "70.30" } });
    fireEvent.change(comment, { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Công bố điểm cuối cùng" }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toBe(required);
    expect(comment.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(comment.getAttribute("aria-describedby")!)).toBe(error);
    expect(publish).not.toHaveBeenCalled();

    fireEvent.change(comment, { target: { value: "Giải thích điều chỉnh" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(comment.getAttribute("aria-invalid")).toBe("false");
    expect(comment.hasAttribute("aria-describedby")).toBe(false);
  });

  it.each(["100.01", "-0.01", "70.290", ""])("rejects invalid input %j without rounding", async (value) => {
    open("finalize");
    const { score } = await fields();
    fireEvent.change(score, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Công bố điểm cuối cùng" }));
    expect(await screen.findByText(/tối đa 2 chữ số thập phân/)).toBeTruthy();
    expect(score.value).toBe(value);
    expect(publish).not.toHaveBeenCalled();
  });

  it("rejects a trimmed comment over 2000 characters", async () => {
    open("finalize");
    const { comment } = await fields();
    fireEvent.change(comment, { target: { value: "a".repeat(2001) } });
    fireEvent.click(screen.getByRole("button", { name: "Công bố điểm cuối cùng" }));
    expect(await screen.findByText(/tối đa 2000 ký tự/)).toBeTruthy();
    expect(publish).not.toHaveBeenCalled();
  });

  it("compares integer hundredths, omits a blank comment and loads fresh detail on success", async () => {
    fetchDetail.mockResolvedValueOnce(ok(submission({ aggregateScore: 70.29 + Number.EPSILON * 100 })));
    fetchDetail.mockResolvedValueOnce(ok(submission({
      gradingStatus: "Finalized", finalScore: 70.29, finalizationComment: "Kết quả đã lưu",
    })));
    open("finalize");
    const { score, comment } = await fields();
    fireEvent.change(score, { target: { value: "70,29" } });
    fireEvent.change(comment, { target: { value: "  " } });
    const dialog = await openConfirmation();
    fireEvent.click(dialog.getByRole("button", { name: "Công bố điểm" }));
    expect(await screen.findByText("Kết quả đã lưu")).toBeTruthy();
    expect(path).toBe("/instructor/submissions/sub-riley-park");
    expect(fetchDetail).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith("sub-riley-park", { finalScore: 70.29 });
  });

  it("explains the irreversible action, focuses cancel and sends nothing on cancel", async () => {
    open("finalize");
    await fields();
    const trigger = screen.getByRole("button", { name: "Công bố điểm cuối cùng" });
    trigger.focus();
    const dialog = await openConfirmation();
    const cancel = dialog.getByRole("button", { name: "Hủy" });
    expect(dialog.getByText("Công bố điểm cuối cùng?")).toBeTruthy();
    expect(dialog.getByText(
      "Học viên Nguyễn Văn A sẽ nhận điểm cuối cùng 70.29/100. Sau khi công bố, bạn không thể hoàn tác.",
    )).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    fireEvent.click(cancel);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(publish).not.toHaveBeenCalled();
  });

  it("guards against a second click before rendering the disabled button", async () => {
    open("finalize");
    await fields();
    const dialog = await openConfirmation();
    const confirm = dialog.getByRole("button", { name: "Công bố điểm" }) as HTMLButtonElement;
    publish.mockImplementationOnce(() => {
      confirm.click();
      return new Promise(() => {});
    });
    fireEvent.click(confirm);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("maps a server-side comment requirement to the field", async () => {
    publish.mockResolvedValueOnce(failure(400, "FINALIZATION_COMMENT_REQUIRED"));
    open("finalize");
    const { comment } = await fields();
    fireEvent.click((await openConfirmation()).getByRole("button", { name: "Công bố điểm" }));
    const error = await screen.findByText(required);
    expect(comment.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(comment.getAttribute("aria-describedby")!)).toBe(error);
  });

  const conflicts = [
    ["SUBMISSION_ALREADY_FINALIZED", { gradingStatus: "Finalized" }, "Bài nộp này đã được chốt điểm."],
    ["SUBMISSION_NOT_LATEST", { isLatest: false }, "Học viên đã nộp bài mới hơn. Chỉ chốt điểm được bài nộp mới nhất."],
    ["SUBMISSION_NOT_AWAITING_FINALIZATION", { gradingStatus: "AwaitingInstructor" }, "Bài nộp chưa sẵn sàng để chốt điểm."],
    ["SUBMISSION_STATE_INCOMPLETE", { aggregateScore: null }, "Dữ liệu chấm điểm chưa đầy đủ. Vui lòng tải lại trang hoặc liên hệ quản trị viên."],
  ] as const;

  const expectBlockedAlert = async (code: string, text: string) => {
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(text);
    const tone = code === "SUBMISSION_ALREADY_FINALIZED" ? "info" : "error";
    expect(alert.classList.contains(`ant-alert-${tone}`)).toBe(true);
  };

  it.each(conflicts)("blocks an initially ineligible submission (%s)", async (code, state, text) => {
    fetchDetail.mockResolvedValueOnce(ok(submission(state)));
    open("finalize");
    await expectBlockedAlert(code, text);
    expect(screen.getByRole("link", { name: "Về chi tiết bài nộp" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Công bố điểm cuối cùng" })).toBeNull();
  });

  it.each(conflicts)("refetches after %s", async (code, state, text) => {
    fetchDetail.mockResolvedValueOnce(ok(submission()));
    fetchDetail.mockResolvedValueOnce(ok(submission(state)));
    publish.mockResolvedValueOnce(failure(409, code));
    open("finalize");
    await fields();
    fireEvent.click((await openConfirmation()).getByRole("button", { name: "Công bố điểm" }));
    await expectBlockedAlert(code, text);
    expect(fetchDetail).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Công bố điểm cuối cùng" })).toBeNull();
  });

  it.each(["503", "network"])("retains input after a %s failure and retries with a trimmed comment", async (mode) => {
    if (mode === "503") publish.mockResolvedValueOnce(failure(503, "SERVICE_UNAVAILABLE"));
    else publish.mockRejectedValueOnce(new Error("offline"));
    open("finalize");
    const { score, comment } = await fields();
    fireEvent.change(score, { target: { value: "71.01" } });
    fireEvent.change(comment, { target: { value: "  Lập luận tốt  " } });
    fireEvent.click((await openConfirmation()).getByRole("button", { name: "Công bố điểm" }));
    expect(await screen.findByText(/Không kết nối được với máy chủ/)).toBeTruthy();
    expect(score.value).toBe("71.01");
    expect(comment.value).toBe("  Lập luận tốt  ");
    fireEvent.click((await openConfirmation("Thử lại")).getByRole("button", { name: "Công bố điểm" }));
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenLastCalledWith("sub-riley-park", {
      finalScore: 71.01,
      comment: "Lập luận tốt",
    });
  });

  it("retries loading after a temporary failure", async () => {
    fetchDetail.mockResolvedValueOnce(failure(503, "SERVICE_UNAVAILABLE"));
    open("finalize");
    expect((await screen.findByRole("alert")).classList.contains("ant-alert-error")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect((await fields()).score.value).toBe("70.29");
  });

  it("handles a gateway authorization error with no statusCode in the body", async () => {
    fetchDetail.mockResolvedValueOnce({ error: { code: "UNAUTHORIZED" } } as never);
    open("finalize");
    expect(await screen.findByText(/Không tìm thấy bài nộp này/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Về danh sách bài nộp" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
  });

  it.each([400, 401, 403, 404])("shows a safe back link when the detail GET returns %s", async (status) => {
    fetchDetail.mockResolvedValueOnce(failure(status, "SUBMISSION_NOT_FOUND"));
    open("finalize", "unknown");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Không tìm thấy bài nộp này");
    expect(alert.classList.contains("ant-alert-error")).toBe(true);
    expect(screen.getByRole("link", { name: "Về danh sách bài nộp" }).getAttribute("href"))
      .toBe("/instructor/submissions");
    expect(screen.queryByRole("button", { name: "Công bố điểm cuối cùng" })).toBeNull();
  });
});

describe("the discrepancy of the reviewers", () => {
  it("is in Vietnamese: the criteria, the reviewers and the way to grade", async () => {
    open("discrepancy");
    expect(
      await screen.findByText("Chênh lệch điểm giữa các người chấm"),
    ).toBeTruthy();
    for (const text of [
      "Cần Giảng viên xử lý",
      "Tiêu chí Rubric",
      "Chênh lệch",
      "Tiêu chí 1",
      "Tiêu chí 3",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByText("Người chấm: Alex Morgan")).toBeTruthy();
    expect(screen.getByText("Người chấm: Taylor Kim")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(ENGLISH);
    fetchDetail.mockResolvedValueOnce(failure(400, "Bad Request"));
    fireEvent.click(screen.getByText("Chấm hoặc điều chỉnh điểm cuối cùng"));
    expect(path).toBe("/instructor/submissions/sub-riley-park/finalize");
    expect(await screen.findByText(/Không tìm thấy bài nộp này/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Công bố điểm cuối cùng" })).toBeNull();
  });

  it("without a comparison it says so, and an unknown submission is told in Vietnamese", async () => {
    open("discrepancy", "sub-alex-morgan");
    expect(
      await screen.findByText("Chưa có so sánh theo tiêu chí."),
    ).toBeTruthy();
    cleanup();
    open("discrepancy", "nobody");
    expect(await screen.findByText("Không tìm thấy bài nộp")).toBeTruthy();
  });
});
