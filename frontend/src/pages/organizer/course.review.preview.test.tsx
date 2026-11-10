// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchOrganizerCourseReviewAPI,
  fetchOrganizerReadingContentAPI,
  fetchOrganizerMaterialPreviewAPI,
} from "@/services/course.service";
import { fetchOrganizerAssessmentReviewAPI } from "@/services/assessment.service";
import CourseReview from "./course.review";

vi.mock("@/services/course.service", () => ({
  fetchOrganizerCourseReviewAPI: vi.fn(),
  fetchOrganizationCourseInstructorsAPI: vi.fn().mockResolvedValue({ statusCode: 200, data: [] }),
  fetchOrganizerReadingContentAPI: vi.fn(),
  fetchOrganizerMaterialPreviewAPI: vi.fn(),
  approveCourseAPI: vi.fn(),
  rejectCourseAPI: vi.fn(),
}));
vi.mock("@/services/assessment.service", () => ({
  fetchOrganizerAssessmentReviewAPI: vi.fn(),
  downloadOrganizerAssignmentPromptAPI: vi.fn(),
}));

const courseId = "019a0000-0000-7000-8000-000000000001";
const materialId = "019a0000-0000-7000-8000-000000000005";
const pdfMaterial = {
  id: materialId, title: "Safety handbook",
  materialType: "Reading", filename: "Safety-Handbook",
  mimeType: "application/pdf", isRequired: true,
  disabled: false, previewAvailable: true, durationSeconds: null, position: 1,
};
const course = {
  id: courseId, name: "Safety Course", versionNumber: 1,
  status: "Submitted", courseType: "Private",
  shortDescription: "Safety", trainingObjectives: "Learn",
  learningOutcomes: [], expectedCompletionDays: 5,
  instructorId: "instructor-1", locked: false,
  submittedAt: "2026-11-10T08:00:00Z",
  modules: [{
    id: "module-1", title: "Basics", position: 1,
    lessons: [{
      id: "lesson-1", title: "Introduction", position: 1,
      content: "Intro text", disabled: false, materials: [pdfMaterial],
    }],
  }],
};

const open = () => render(
  <MemoryRouter initialEntries={[`/organizer/courses/${courseId}/review`]}>
    <Routes>
      <Route path="/organizer/courses/:courseId/review" element={<CourseReview />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("URL", Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:uc21-reading-preview"),
    revokeObjectURL: vi.fn(),
  }));
  vi.mocked(fetchOrganizerCourseReviewAPI).mockResolvedValue({
    statusCode: 200, data: course,
  } as never);
  vi.mocked(fetchOrganizerAssessmentReviewAPI).mockResolvedValue({
    statusCode: 200, data: { courseId, items: [] },
  } as never);
  vi.mocked(fetchOrganizerReadingContentAPI).mockResolvedValue({
    data: new Blob(["%PDF-1.7"], { type: "application/pdf" }),
  } as never);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function showMaterial() {
  open();
  const moduleTitle = await screen.findByText("Module 1: Basics");
  fireEvent.click(moduleTitle);
  await screen.findByText("Safety-Handbook.pdf");
}

describe("UC21.2 Organizer Reading preview", () => {
  it("opens an inline Blob PDF without triggering an automatic download", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await showMaterial();
    fireEvent.click(screen.getByRole("button", { name: /Preview/ }));
    await waitFor(() => expect(fetchOrganizerReadingContentAPI).toHaveBeenCalledWith(
      courseId, materialId,
    ));
    expect(await screen.findByTitle("Reading material preview")).toBeTruthy();
    expect(click).not.toHaveBeenCalled();
    expect(fetchOrganizerMaterialPreviewAPI).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it("downloads the PDF only when the separate Download control is clicked", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await showMaterial();
    fireEvent.click(screen.getByRole("button", { name: /Download/ }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(fetchOrganizerReadingContentAPI).toHaveBeenCalledWith(courseId, materialId);
    click.mockRestore();
  });
});
