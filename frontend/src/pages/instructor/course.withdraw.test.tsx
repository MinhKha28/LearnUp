// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchCourseDetailAPI, withdrawCourseSubmissionAPI } from "@/services/course.service";
import CourseWithdraw from "./course.withdraw";

const notifications = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("antd", () => ({
  message: notifications,
  Alert: ({ message }: { message: ReactNode }) => <div role="alert">{message}</div>,
  Skeleton: () => <div>Loading</div>,
}));

vi.mock("@/components/instructor/instructor.ui", () => ({
  InstructorPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  WarningPanel: ({ title, children }: { title: string; children: ReactNode }) =>
    <section><h2>{title}</h2>{children}</section>,
  InstructorButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    type?: string;
  }) => <button disabled={disabled} onClick={onClick}>{children}</button>,
}));

vi.mock("@/services/course.service", () => ({
  fetchCourseDetailAPI: vi.fn(),
  withdrawCourseSubmissionAPI: vi.fn(),
}));

const fetchCourse = vi.mocked(fetchCourseDetailAPI);
const withdraw = vi.mocked(withdrawCourseSubmissionAPI);
const course = {
  id: "course-1",
  name: "Safety Training",
  status: "Submitted",
};

function open() {
  render(
    <MemoryRouter initialEntries={["/instructor/courses/course-1/withdraw"]}>
      <Routes>
        <Route path="/instructor/courses/:courseId/withdraw" element={<CourseWithdraw />} />
        <Route path="/instructor/courses/:courseId" element={<div>Course Detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchCourse.mockResolvedValue({
    statusCode: 200,
    data: course,
  } as Awaited<ReturnType<typeof fetchCourseDetailAPI>>);
});

afterEach(() => cleanup());

it("loads the Submitted Course and navigates only on successful withdrawal", async () => {
  withdraw.mockResolvedValue({
    statusCode: 201,
    data: { ...course, status: "Draft", submittedAt: null },
  } as Awaited<ReturnType<typeof withdrawCourseSubmissionAPI>>);
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Thu hồi về bản nháp" }));
  expect(await screen.findByText("Course Detail")).toBeTruthy();
  expect(withdraw).toHaveBeenCalledWith("course-1");
  expect(notifications.success).toHaveBeenCalledTimes(1);
});

it("shows an API failure, reloads the Course, and does not navigate", async () => {
  withdraw.mockRejectedValue({
    response: { data: { code: "COURSE_CHANGED" } },
  });
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Thu hồi về bản nháp" }));
  await waitFor(() => expect(fetchCourse).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole("button", { name: "Thu hồi về bản nháp" })).toBeTruthy();
  expect(screen.queryByText("Course Detail")).toBeNull();
  expect(notifications.error).toHaveBeenCalledWith(
    "Trạng thái khóa học đã thay đổi. Vui lòng tải lại trang và thử lại.",
  );
});

it("does not navigate after a non-successful API response", async () => {
  withdraw.mockResolvedValue({
    statusCode: 409,
    data: null,
    error: { code: "INVALID_COURSE_STATUS" },
  } as unknown as Awaited<ReturnType<typeof withdrawCourseSubmissionAPI>>);
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Thu hồi về bản nháp" }));
  await waitFor(() => expect(fetchCourse).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("Course Detail")).toBeNull();
  expect(notifications.success).not.toHaveBeenCalled();
});

it("ignores duplicate submission while request is pending", async () => {
  let resolveRequest!: (value: unknown) => void;
  withdraw.mockImplementation(() => new Promise<unknown>((resolve) => {
    resolveRequest = resolve;
  }) as unknown as ReturnType<typeof withdrawCourseSubmissionAPI>);
  open();
  const button = await screen.findByRole("button", { name: "Thu hồi về bản nháp" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(withdraw).toHaveBeenCalledTimes(1);
  resolveRequest({
    statusCode: 201,
    data: { ...course, status: "Draft", submittedAt: null },
  });
  expect(await screen.findByText("Course Detail")).toBeTruthy();
});
