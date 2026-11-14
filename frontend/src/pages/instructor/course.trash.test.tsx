// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App, Modal } from "antd";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { courseAxios as axios } from "@/services/axios.customize";
import { submitCourseForApprovalAPI } from "@/services/course.service";
import type { ICourseDetail, ICourseTrashItem } from "@/types/course.types";
import CourseDetail from "./course.detail";
import CourseTrash from "./course.trash";
import MyCourses from "./my.courses";

vi.mock("@/services/axios.customize", () => ({
  courseAxios: { delete: vi.fn(), get: vi.fn(), post: vi.fn() },
}));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);
const remove = vi.mocked(axios.delete);
const course: ICourseDetail = {
  id: "course-1",
  chainId: "chain-1",
  versionNumber: 1,
  name: "Draft Course",
  shortDescription: null,
  trainingObjectives: null,
  learningOutcomes: [],
  coverFileId: null,
  coverUrl: null,
  expectedCompletionDays: 5,
  estimatedDurationMinutes: null,
  courseType: "Private",
  status: "Draft",
  locked: false,
  submittedAt: null,
  publishedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
};

beforeEach(() => {
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => computedStyle(element));
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function open(path: string) {
  render(
    <App>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/instructor/courses" element={<MyCourses />} />
          <Route path="/instructor/courses/trash" element={<CourseTrash />} />
          <Route path="/instructor/courses/:courseId" element={<CourseDetail />} />
        </Routes>
      </MemoryRouter>
    </App>,
  );
}

it("keeps submission and moves a Draft Course to Trash after confirmation", async () => {
  get
    .mockResolvedValueOnce({ data: course })
    .mockResolvedValueOnce({ data: { result: [], meta: { total: 0 } } });
  remove.mockResolvedValue({ data: { courseId: course.id } });
  const confirm = vi.spyOn(Modal, "confirm").mockImplementation(
    () => ({ destroy: vi.fn(), update: vi.fn() }),
  );
  open("/instructor/courses/course-1");

  expect(await screen.findByRole("button", { name: "Gửi phê duyệt" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Chuyển vào thùng rác" }));
  expect(remove).not.toHaveBeenCalled();
  await act(async () => { await confirm.mock.calls[0][0].onOk?.(); });
  expect(remove).toHaveBeenCalledWith("/api/v1/courses/course-1");
  expect(await screen.findByRole("heading", { name: "Khóa học của tôi" })).toBeTruthy();

  await submitCourseForApprovalAPI("another/course");
  expect(post).toHaveBeenCalledWith("/api/v1/courses/another%2Fcourse/submit");
});

it("opens Trash from My Courses, restores a Course, and refreshes the listing", async () => {
  const trashedCourse: ICourseTrashItem = {
    id: course.id,
    chainId: course.chainId,
    name: course.name,
    versionNumber: course.versionNumber,
    status: "Draft",
    deletedAt: new Date().toISOString(),
    deletedBy: "instructor-1",
    purgeAt: new Date(Date.now() + 60_000).toISOString(),
  };
  get
    .mockResolvedValueOnce({ data: { result: [], meta: { total: 0 } } })
    .mockResolvedValueOnce({ data: [trashedCourse] })
    .mockResolvedValueOnce({ data: [] });
  post.mockResolvedValue({ data: { courseId: course.id, restored: true } });
  open("/instructor/courses");

  fireEvent.click(screen.getByRole("button", { name: "Thùng rác" }));
  expect(await screen.findByText(course.name)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Khôi phục" }));

  await screen.findByText("Thùng rác khóa học đang trống.");
  expect(post).toHaveBeenCalledWith("/api/v1/courses/course-1/restore");
  await waitFor(() =>
    expect(get.mock.calls.filter(([path]) => path === "/api/v1/courses/trash")).toHaveLength(2),
  );
});

it("shows the Instructor Course version and pagination total in Vietnamese", async () => {
  get.mockResolvedValueOnce({
    data: {
      result: [{
        id: course.id,
        chainId: course.chainId,
        name: course.name,
        versionNumber: 1,
        courseType: "Private",
        status: "Draft",
        locked: false,
        learnerCount: 0,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      }],
      meta: { total: 1 },
    },
  });

  open("/instructor/courses");

  expect(await screen.findByText("Phiên bản 1")).toBeTruthy();
  expect(await screen.findByText("1 khóa học")).toBeTruthy();
  expect(screen.queryByText("Version 1")).toBeNull();
  expect(screen.queryByText("1 Courses")).toBeNull();
});
