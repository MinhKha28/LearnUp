// @vitest-environment jsdom
// UC30: the page that confirms a submission, in Vietnamese. jsdom is for this file only.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { ISubmissionReceipt } from "@/types/assessment.types";
import AssignmentSubmitted from "./assignment.submitted";

afterEach(cleanup);

const ENGLISH =
  /Assignment|Submission|submitted|Submitted|Back to|View |Reviews are due|peer review|Instructor|Your |You have|awaiting|resubmit|Assessments/;

const receipt = (over: Partial<ISubmissionReceipt> = {}): ISubmissionReceipt => ({
  id: "s1",
  assessmentId: "a1",
  submissionNumber: 1,
  submittedAt: "2026-11-02T03:04:00Z",
  gradingStatus: "Submitted",
  cycle: { id: "c1", opensAt: "2026-11-01T00:00:00Z", closesAt: "2026-11-05T10:00:00Z", reviewDueAt: "2026-11-08T10:00:00Z" },
  attempts: { maxConsecutiveAttempts: 3, remainingAttempts: 2, lockoutHours: 24, lockedUntil: null },
  placement: "OPEN_CYCLE",
  replacedSubmissionId: null,
  ...over,
});

const Where = () => <p>đường dẫn: {useLocation().pathname}</p>;

const renderPage = (state?: object) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/learner/courses/e1/assignments/a1/submitted", state }]}>
      <Routes>
        <Route path="/learner/courses/:enrollmentId/assignments/:assignmentId/submitted" element={<AssignmentSubmitted />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe("UC30 the page of a submission received, in Vietnamese and Vietnam time", () => {
  it("confirms a new submission that went into a peer review cycle", () => {
    renderPage({ receipt: receipt(), title: "Kế hoạch ứng phó" });
    expect(screen.getByText("Đã nộp bài tập")).toBeTruthy();
    expect(screen.getByText("Đã nhận bài nộp")).toBeTruthy();
    expect(screen.getByText("Kế hoạch ứng phó đang chờ được chấm.")).toBeTruthy();
    expect(screen.getByText("Nộp lúc 02/11/2026 10:04.")).toBeTruthy();
    expect(screen.getByText(/Bài này nằm trong chu kỳ chấm chéo đóng lúc 05\/11\/2026 17:00\. Hạn chấm bài là 08\/11\/2026 17:00\./)).toBeTruthy();
    expect(screen.getByText("Số lần nộp còn lại trước khi phải tạm dừng: 2/3.")).toBeTruthy();
    expect(screen.getByText("Bài nộp mới nhất của bạn sẽ được dùng làm kết quả của bài tập.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it("says a resubmission replaces the previous one in the cycle", () => {
    renderPage({ receipt: receipt({ placement: "REPLACES_IN_CYCLE", replacedSubmissionId: "s0" }) });
    expect(screen.getByText("Đã nộp lại bài tập")).toBeTruthy();
    expect(screen.getByText("Đã nhận bài nộp lại")).toBeTruthy();
    expect(screen.getByText("Bài làm của bạn đang chờ được chấm.")).toBeTruthy();
    expect(screen.getByText(/Bài này thay bài nộp trước của bạn trong chu kỳ chấm chéo đóng lúc/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it("tells that the Instructor grades it when there is no cycle, for a first submission and for a resubmission", () => {
    const { unmount } = renderPage({ receipt: receipt({ cycle: null, placement: "INSTRUCTOR" }) });
    expect(screen.getByText("Giảng viên sẽ chấm bài này.")).toBeTruthy();
    unmount();
    renderPage({ receipt: receipt({ cycle: null, placement: "INSTRUCTOR", replacedSubmissionId: "s0" }) });
    expect(screen.getByText(/Chu kỳ chấm chéo của bài nộp trước đã đóng, hoặc bài tập không chấm chéo/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it("tells when the next submission is allowed once all the submissions in a row are used", () => {
    renderPage({
      receipt: receipt({ attempts: { maxConsecutiveAttempts: 3, remainingAttempts: 0, lockoutHours: 24, lockedUntil: "2026-11-03T03:00:00Z" } }),
    });
    expect(screen.getByText(/Bạn đã dùng hết 3 lần nộp liên tiếp\. Bạn nộp lại được từ\s+03\/11\/2026 10:00\./)).toBeTruthy();
    expect(screen.queryByText(/Số lần nộp còn lại/)).toBeNull();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it("goes back to the list of the Course, or to the Assignment", () => {
    renderPage({ receipt: receipt() });
    fireEvent.click(screen.getByText("Xem bài tập"));
    expect(screen.getByText("đường dẫn: /learner/courses/e1/assignments/a1")).toBeTruthy();
    cleanup();
    renderPage({ receipt: receipt() });
    fireEvent.click(screen.getByText("Quay lại Bài đánh giá"));
    expect(screen.getByText("đường dẫn: /learner/courses/e1/assessments")).toBeTruthy();
  });

  it("sends a reload or a bookmark (no receipt) back to the list", () => {
    renderPage();
    expect(screen.getByText("đường dẫn: /learner/courses/e1/assessments")).toBeTruthy();
  });
});
