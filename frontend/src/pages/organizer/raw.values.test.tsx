// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseList } from "@/components/organizer/course.handover.fields";
import { getInstructorDetailAPI, getLearnerDetailAPI } from "@/services/organization.service";
import { courseStatusText, courseTypeText } from "@/utils/organizer.labels";
import InstructorDetail from "./instructor.detail";
import LearnerDetail from "./learner.detail";
import LearnerReport from "./learner.report";

vi.mock("@/config/env", () => ({
  env: { backendUrl: { tenant: "/", course: "/", assessment: "/" } },
}));
vi.mock("@/services/organization.service", () => ({
  getInstructorDetailAPI: vi.fn(),
  getLearnerDetailAPI: vi.fn(),
}));

const now = "2026-11-10T08:00:00.000Z";
const base = {
  id: "a1", fullName: "Trần An", email: "an@example.vn", department: "Kỹ thuật",
  status: "Active", activatedAt: now, createdAt: now, invitationExpired: false,
  avatarUrl: null, invitation: null,
};

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

describe("labels never show a raw English API value", () => {
  it("maps known course values and falls back for unknown ones", () => {
    expect(courseStatusText("Published")).toBe("Đã phát hành");
    expect(courseTypeText("Public")).toBe("Công khai");
    expect(courseTypeText("Private")).toBe("Riêng tư");
    expect(courseStatusText("Weird")).toBe("Không xác định");
    expect(courseTypeText("Weird")).toBe("Không xác định");
  });
});

describe("CourseList in the instructor deactivate/delete dialog", () => {
  it("shows the Vietnamese status, and Không xác định for an unknown one", () => {
    render(<CourseList courses={[
      { chainId: "1", courseId: "1", name: "Khóa A", versionNumber: 1, status: "Published", courseType: "Public", approvedAt: null },
      { chainId: "2", courseId: "2", name: "Khóa B", versionNumber: 2, status: "Weird" as never, courseType: "Private", approvedAt: null },
    ]} />);
    expect(screen.getByText(/Đã phát hành/)).toBeTruthy();
    expect(screen.getByText(/Không xác định/)).toBeTruthy();
    expect(screen.queryByText(/Published|Weird/)).toBeNull();
  });
});

describe("Instructor detail course table", () => {
  it("shows Vietnamese course status and type, unknown values as Không xác định", async () => {
    vi.mocked(getInstructorDetailAPI).mockResolvedValue({
      statusCode: 200,
      data: { ...base, courses: [
        { chainId: "1", courseId: "1", name: "Khóa A", versionNumber: 1, status: "Published", courseType: "Public", approvedAt: now },
        { chainId: "2", courseId: "2", name: "Khóa B", versionNumber: 1, status: "Weird", courseType: "Odd", approvedAt: null },
      ], violations: null },
    } as never);
    render(
      <MemoryRouter initialEntries={["/organizer/instructors/a1"]}>
        <Routes><Route path="/organizer/instructors/:instructorId" element={<InstructorDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Đã phát hành")).toBeTruthy();
    expect(screen.getByText("Công khai")).toBeTruthy();
    expect(screen.getAllByText("Không xác định").length).toBe(2);
    expect(screen.queryByText("Published")).toBeNull();
    expect(screen.queryByText("Public")).toBeNull();
  });
});

describe("Learner detail enrollment table", () => {
  it("shows Không xác định for an unknown enrollment status", async () => {
    vi.mocked(getLearnerDetailAPI).mockResolvedValue({
      statusCode: 200,
      data: { ...base, enrollments: [{
        enrollmentId: "e1", courseId: "c1", course: { name: "Khóa A", versionNumber: 1 },
        enrollmentType: "Required", status: "Weird", enrolledAt: now, assignedAt: now, dueAt: now,
        completedAt: null, requiredMaterials: { completed: 0, total: 1 },
      }] },
    } as never);
    render(
      <MemoryRouter initialEntries={["/organizer/learners/a1"]}>
        <Routes><Route path="/organizer/learners/:learnerId" element={<LearnerDetail />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Không xác định")).toBeTruthy());
    expect(screen.getByText("Bắt buộc")).toBeTruthy();
    expect(screen.queryByText("Weird")).toBeNull();
  });
});

describe("Learner report header", () => {
  it("renders the account status in Vietnamese", () => {
    render(
      <MemoryRouter initialEntries={["/organizer/learners/minh-le/report"]}>
        <Routes><Route path="/organizer/learners/:learnerId/report" element={<LearnerReport />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Đang hoạt động/)).toBeTruthy();
    expect(screen.queryByText(/\bActive\b/)).toBeNull();
  });
});
