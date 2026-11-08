// @vitest-environment jsdom
// UC32.3 (finalize) and the screen of the discrepancy: still on sample data, but their texts are Vietnamese. jsdom is for this file only.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { message } from "antd";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/services/axios.customize", () => ({
  assessmentAxios: {},
  default: {},
}));

import SubmissionDiscrepancy from "./submission.discrepancy";
import SubmissionFinalize from "./submission.finalize";

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
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

const ENGLISH =
  /Finalize|Publish|Feedback|Minimum passing|Peer Review aggregate|\[|Reviewer:|Rubric criterion|Difference|Back to|not found|may have been removed|Instructor review required|Criterion/;

describe("finalizing a score", () => {
  it("is in Vietnamese, with no placeholder in brackets", async () => {
    open("finalize");
    expect(await screen.findByText("Chốt điểm bài tập")).toBeTruthy();
    for (const text of [
      "Xác nhận hoặc điều chỉnh điểm tổng hợp trước khi công bố.",
      "Điểm tổng hợp từ chấm chéo",
      "Điểm cuối cùng",
      "Điểm đạt tối thiểu",
      "Nhận xét cho học viên",
      "Công bố kết quả",
      "Công bố điểm cuối cùng",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(
      screen.getByPlaceholderText("Giải thích kết quả đánh giá cuối cùng..."),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Điểm xác nhận hoặc đã điều chỉnh"),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it("publishing says so in Vietnamese and goes back to the list", async () => {
    const success = vi
      .spyOn(message, "success")
      .mockImplementation((() => undefined) as never);
    open("finalize");
    fireEvent.click(await screen.findByText("Công bố điểm cuối cùng"));
    expect(success).toHaveBeenCalledWith("Đã công bố điểm cuối cùng.");
    expect(path).toBe("/instructor/submissions");
  });

  it("an unknown submission is told in Vietnamese with the way back", async () => {
    open("finalize", "nobody");
    expect(await screen.findByText("Không tìm thấy bài nộp")).toBeTruthy();
    expect(screen.getByText("Bài nộp này có thể đã bị xóa.")).toBeTruthy();
    fireEvent.click(screen.getByText("Về danh sách bài nộp"));
    expect(path).toBe("/instructor/submissions");
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
      "Tiêu chí chấm",
      "Chênh lệch",
      "Tiêu chí 1",
      "Tiêu chí 3",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByText("Người chấm: Alex Morgan")).toBeTruthy();
    expect(screen.getByText("Người chấm: Taylor Kim")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(ENGLISH);
    fireEvent.click(screen.getByText("Chấm hoặc điều chỉnh điểm cuối cùng"));
    expect(path).toBe("/instructor/submissions/sub-riley-park/finalize");
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
