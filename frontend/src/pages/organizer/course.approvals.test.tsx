// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOrganizationCoursesAPI } from "@/services/course.service";
import CourseApprovals from "./course.approvals";

vi.mock("@/services/course.service", () => ({
  fetchOrganizationCoursesAPI: vi.fn(),
}));

const submitted = {
  id: "019a0000-0000-7000-8000-000000000001",
  chainId: "019a0000-0000-7000-8000-000000000002",
  name: "Safety Course", versionNumber: 1, courseType: "Private",
  status: "Submitted", submittedAt: "2026-11-10T08:00:00.000Z",
  instructor: { id: "instructor-1", fullName: "Demo Instructor" },
  learnerCount: 0, createdAt: "2026-11-09T08:00:00.000Z",
  updatedAt: "2026-11-10T08:00:00.000Z",
};

function open() {
  render(
    <MemoryRouter initialEntries={["/organizer/courses/approvals"]}>
      <Routes>
        <Route path="/organizer/courses/approvals" element={<CourseApprovals />} />
        <Route path="/organizer/courses/:courseId/review" element={<div>Review destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UC21.3 Pending Approvals", () => {
  it("loads real Submitted Courses and navigates with their UUID", async () => {
    vi.mocked(fetchOrganizationCoursesAPI).mockResolvedValue({
      statusCode: 200, data: { result: [submitted], meta: { total: 1 } },
    } as never);
    open();
    expect(await screen.findByText("Safety Course")).toBeTruthy();
    expect(fetchOrganizationCoursesAPI).toHaveBeenCalledWith({
      current: 1, pageSize: 10, status: "Submitted",
    });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText("Review destination")).toBeTruthy();
  });

  it("never offers a Review link for an inconsistent non-Submitted response", async () => {
    vi.mocked(fetchOrganizationCoursesAPI).mockResolvedValue({
      statusCode: 200,
      data: { result: [{ ...submitted, status: "Published" }], meta: { total: 1 } },
    } as never);
    open();
    await waitFor(() => expect(fetchOrganizationCoursesAPI).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
  });

  it("shows a retry action on an HTTP error response", async () => {
    vi.mocked(fetchOrganizationCoursesAPI).mockResolvedValue({
      statusCode: 403, message: "Forbidden",
    } as never);
    open();
    expect(await screen.findByText("Unable to load pending approval Courses.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetchOrganizationCoursesAPI).toHaveBeenCalledTimes(2));
  });
});
