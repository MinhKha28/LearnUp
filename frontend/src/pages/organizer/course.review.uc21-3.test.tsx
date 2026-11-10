// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveCourseAPI, fetchOrganizerCourseReviewAPI, rejectCourseAPI,
} from "@/services/course.service";
import { fetchOrganizerAssessmentReviewAPI } from "@/services/assessment.service";
import CourseReview from "./course.review";

vi.mock("@/services/course.service", () => ({
  approveCourseAPI: vi.fn(),
  rejectCourseAPI: vi.fn(),
  fetchOrganizerCourseReviewAPI: vi.fn(),
  fetchOrganizerMaterialPreviewAPI: vi.fn(),
  fetchOrganizerReadingContentAPI: vi.fn(),
}));
vi.mock("@/services/assessment.service", () => ({
  fetchOrganizerAssessmentReviewAPI: vi.fn(),
  downloadOrganizerAssignmentPromptAPI: vi.fn(),
}));

const courseId = "019a0000-0000-7000-8000-000000000001";
const course = {
  id: courseId, name: "Safety Course", versionNumber: 1,
  status: "Submitted", courseType: "Private",
  shortDescription: "Learn safety", trainingObjectives: "Objectives",
  learningOutcomes: [], expectedCompletionDays: 5,
  instructorId: "instructor-1", locked: false,
  submittedAt: "2026-11-10T08:00:00Z", modules: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  vi.mocked(fetchOrganizerCourseReviewAPI).mockResolvedValue({
    statusCode: 200, data: course,
  } as never);
  vi.mocked(fetchOrganizerAssessmentReviewAPI).mockResolvedValue({
    statusCode: 200, data: { courseId, items: [] },
  } as never);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function open() {
  render(
    <MemoryRouter initialEntries={[`/organizer/courses/${courseId}/review`]}>
      <Routes>
        <Route path="/organizer/courses/:courseId/review" element={<CourseReview />} />
        <Route path="/organizer/courses/approvals" element={<div>Pending destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("UC21.3 review decisions", () => {
  it("cancels approval without sending a request", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Approve Course" }));
    expect(await screen.findByText("Approve Course", { selector: ".ant-modal-title" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(approveCourseAPI).not.toHaveBeenCalled();
  });

  it("approves once and returns to Pending Approvals", async () => {
    vi.mocked(approveCourseAPI).mockResolvedValue({
      statusCode: 200, data: { id: courseId, status: "Published" },
    } as never);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Approve Course" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Approval" }));
    expect(await screen.findByText("Pending destination")).toBeTruthy();
    expect(approveCourseAPI).toHaveBeenCalledTimes(1);
    expect(approveCourseAPI).toHaveBeenCalledWith(courseId);
  });

  it("requires rejection reason and preserves it on a conflict", async () => {
    vi.mocked(rejectCourseAPI).mockResolvedValue({ statusCode: 409 } as never);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Reject Course" }));
    const confirm = screen.getByRole("button", { name: "Confirm Rejection" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Rejection reason" }), {
      target: { value: "  Improve the Assignment rubric  " },
    });
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(rejectCourseAPI).toHaveBeenCalledWith(courseId, {
      reason: "Improve the Assignment rubric",
    }));
    expect(screen.getByRole("textbox", { name: "Rejection reason" })).toHaveProperty(
      "value", "  Improve the Assignment rubric  ",
    );
    expect(screen.queryByText("Pending destination")).toBeNull();
  });

  it("blocks decisions when Assessment loading fails", async () => {
    vi.mocked(fetchOrganizerAssessmentReviewAPI).mockResolvedValue({
      statusCode: 503, data: null,
    } as never);
    open();
    const button = await screen.findByRole("button", { name: "Approve Course" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
