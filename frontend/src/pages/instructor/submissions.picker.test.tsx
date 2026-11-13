// @vitest-environment jsdom
// The Submissions page without an Assignment: the Instructor picks a Course, then an Assignment, instead of a dead end.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/axios.customize", () => ({
  assessmentAxios: {},
  default: {},
}));
vi.mock("@/services/instructor.submission.service", () => ({
  getAssignmentSubmissionsAPI: vi.fn(),
}));
vi.mock("@/services/course.service", () => ({
  fetchManagedCoursesAPI: vi.fn(),
}));
vi.mock("@/services/assessment.service", () => ({
  fetchAssignmentsAPI: vi.fn(),
}));

import { fetchAssignmentsAPI } from "@/services/assessment.service";
import { fetchManagedCoursesAPI } from "@/services/course.service";
import { getAssignmentSubmissionsAPI } from "@/services/instructor.submission.service";
import Submissions from "./submissions";

const courses = vi.mocked(fetchManagedCoursesAPI);
const assignments = vi.mocked(fetchAssignmentsAPI);
const submissions = vi.mocked(getAssignmentSubmissionsAPI);

let search = "";
const Where = () => {
  search = useLocation().search;
  return null;
};
const open = () =>
  render(
    <MemoryRouter initialEntries={["/instructor/submissions"]}>
      <Routes>
        <Route
          path="/instructor/submissions"
          element={
            <>
              <Submissions />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

// antd Select: open the list, then click the option by its text
const choose = async (placeholder: string, option: string) => {
  const box = screen.getByText(placeholder).closest(".ant-select")!;
  fireEvent.mouseDown(box.querySelector(".ant-select-selector")!);
  fireEvent.click(await screen.findByTitle(option));
};

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
  search = "";
  courses.mockReset();
  assignments.mockReset();
  submissions.mockReset();
  courses.mockResolvedValue({
    data: { result: [{ id: "course-1", name: "Khóa Toán" }] },
  } as never);
  assignments.mockResolvedValue({
    data: { items: [{ id: "as-1", title: "Bài luận số 1" }] },
  } as never);
  submissions.mockResolvedValue({ data: undefined } as never);
});
afterEach(cleanup);

describe("Submissions page without an Assignment", () => {
  it("lets the Instructor pick a Course and an Assignment, then opens its submissions", async () => {
    open();
    expect(
      screen.getByText("Chọn khóa học và bài tập để xem bài nộp."),
    ).toBeTruthy();
    expect(submissions).not.toHaveBeenCalled();

    await choose("Chọn khóa học", "Khóa Toán");
    await waitFor(() => expect(assignments).toHaveBeenCalledWith("course-1"));
    await choose("Chọn bài tập để xem bài nộp", "Bài luận số 1");

    await waitFor(() => expect(search).toBe("?assessmentId=as-1"));
    await waitFor(() =>
      expect(submissions).toHaveBeenCalledWith("as-1", expect.anything()),
    );
  });

  it("says so when the Instructor has no Course", async () => {
    courses.mockResolvedValue({ data: { result: [] } } as never);
    open();
    await waitFor(() => expect(courses).toHaveBeenCalled());
    fireEvent.mouseDown(
      screen.getByText("Chọn khóa học").closest(".ant-select")!.querySelector(".ant-select-selector")!,
    );
    expect(await screen.findByText("Bạn chưa có khóa học nào")).toBeTruthy();
  });

  it("shows an error, not a blank page, when the Assignments cannot be loaded", async () => {
    assignments.mockRejectedValue(new Error("down"));
    open();
    await choose("Chọn khóa học", "Khóa Toán");
    expect(
      await screen.findByText(/Không thể tải danh sách bài tập/),
    ).toBeTruthy();
  });
});
