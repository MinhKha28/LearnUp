// @vitest-environment jsdom
// The form lock (BR-210), by interaction: the rest of the suites keep the node environment, jsdom is for this file only.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/axios.customize", () => ({ assessmentAxios: {}, default: {} }));
vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  fetchLearnerAssignmentAPI: vi.fn(),
  submitAssignmentAPI: vi.fn(),
  resubmitAssignmentAPI: vi.fn(),
  downloadLearnerPromptFileAPI: vi.fn(),
}));

import * as api from "@/services/assessment.service";
import AssignmentWork from "./assignment.work";

const assignment = {
  id: "a1",
  courseId: "c1",
  title: "Essay",
  prompt: "Write it",
  promptFile: null,
  passingScore: 70,
  expectedDurationMinutes: 30,
  peerReviewEnabled: false,
  rubric: [{ id: "r1", name: "Content", description: "d", maxPoints: 10 }],
  attempts: { maxConsecutiveAttempts: 3, remaining: 3, lockedUntil: null },
  readOnly: false,
  latestSubmission: {
    id: "s1",
    submissionNumber: 1,
    submittedAt: "2026-10-20T08:00:00Z",
    gradingStatus: "AwaitingInstructor",
    fileName: null,
  },
  resubmission: null,
};
const refused = (code: string) => ({ statusCode: 409, error: { code, message: "An English message." } });

const mount = (mode: "submit" | "resubmit") =>
  render(
    <MemoryRouter initialEntries={[`/learner/courses/c1/assignments/a1/${mode}`]}>
      <Routes>
        <Route path="/learner/courses/:enrollmentId/assignments/:assignmentId/:mode" element={<AssignmentWork mode={mode} />} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as unknown as MediaQueryList);
});
beforeEach(() => {
  vi.mocked(api.fetchLearnerAssignmentAPI).mockResolvedValue({ statusCode: 200, data: assignment } as never);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const typeDraft = async () => {
  const box = (await screen.findByPlaceholderText("Write your response here...")) as HTMLTextAreaElement;
  fireEvent.change(box, { target: { value: "my draft" } });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["%PDF-1.7 x"], "work.pdf", { type: "application/pdf" })] } });
  await screen.findByText("work.pdf");
  return { box };
};
/** Clicking the upload area opens the file picker (it clicks the hidden input) unless the area is disabled. */
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement; // antd replaces it after a pick
const pickerOpensOnClick = () => {
  const spy = vi.spyOn(fileInput(), "click");
  fireEvent.click(document.querySelector(".ant-upload-btn") as HTMLElement);
  const opened = spy.mock.calls.length > 0;
  spy.mockRestore();
  return opened;
};
const sendButton = () => screen.getByRole("button", { name: /resubmit work|submit work/i }) as HTMLButtonElement;

describe("the form when the Enrollment stops being active while it is open", () => {
  it("keeps the text and the file, closes the form and says why in Vietnamese; does not reload", async () => {
    vi.mocked(api.resubmitAssignmentAPI).mockResolvedValue(refused("ENROLLMENT_NOT_ACTIVE") as never);
    mount("resubmit");
    const { box } = await typeDraft();
    expect(sendButton().disabled).toBe(false);
    expect(fileInput().disabled).toBe(false);
    expect(pickerOpensOnClick()).toBe(true); // control: while the form is open the picker opens

    fireEvent.click(sendButton());

    await screen.findByText("Không thể nộp bài");
    expect(screen.getAllByText(/Nội dung bạn đã nhập vẫn được giữ trên trang này/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hãy liên hệ Quản lý đào tạo/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/An English message/)).toBeNull();
    // the draft is kept
    expect(box.value).toBe("my draft");
    expect(screen.getByText("work.pdf")).toBeTruthy();
    // and the form is closed
    expect(box.disabled).toBe(true);
    expect(document.querySelector(".ant-upload-disabled")).not.toBeNull();
    expect(fileInput().disabled).toBe(true);
    expect(pickerOpensOnClick()).toBe(false); // the file picker no longer opens
    expect(sendButton().disabled).toBe(true);
    // the GET is refused too once the Enrollment is not active, so the page is not asked again
    expect(api.fetchLearnerAssignmentAPI).toHaveBeenCalledTimes(1);
    expect(api.resubmitAssignmentAPI).toHaveBeenCalledTimes(1);
  });

  it("a click on the closed submit button sends nothing more", async () => {
    vi.mocked(api.resubmitAssignmentAPI).mockResolvedValue(refused("ENROLLMENT_NOT_ACTIVE") as never);
    mount("resubmit");
    await typeDraft();
    fireEvent.click(sendButton());
    await screen.findByText("Không thể nộp bài");
    fireEvent.click(sendButton());
    expect(api.resubmitAssignmentAPI).toHaveBeenCalledTimes(1);
  });

  it("the same for the first submission (UC30), not only for the resubmission", async () => {
    vi.mocked(api.fetchLearnerAssignmentAPI).mockResolvedValue({ statusCode: 200, data: { ...assignment, latestSubmission: null } } as never);
    vi.mocked(api.submitAssignmentAPI).mockResolvedValue(refused("ENROLLMENT_NOT_ACTIVE") as never);
    mount("submit");
    const { box } = await typeDraft();
    fireEvent.click(sendButton());
    await screen.findByText("Không thể nộp bài");
    expect(box.value).toBe("my draft");
    expect(box.disabled).toBe(true);
    expect(sendButton().disabled).toBe(true);
  });

  it("Completed is different: the answer still works, so the page is read again and shows read-only", async () => {
    vi.mocked(api.resubmitAssignmentAPI).mockResolvedValue(refused("ENROLLMENT_COMPLETED") as never);
    mount("resubmit");
    await typeDraft();
    vi.mocked(api.fetchLearnerAssignmentAPI).mockResolvedValue({ statusCode: 200, data: { ...assignment, readOnly: true } } as never);
    fireEvent.click(sendButton());
    await waitFor(() => expect(api.fetchLearnerAssignmentAPI).toHaveBeenCalledTimes(2));
    await screen.findByText("Course completed");
    expect(screen.queryByText("Không thể nộp bài")).toBeNull();
    expect(sendButton().disabled).toBe(true);
  });
});
