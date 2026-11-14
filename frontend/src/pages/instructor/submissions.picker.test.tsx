// @vitest-environment jsdom
// The Submissions page starts with a Course and an Assignment, as the peer review cycles do.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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

const assignmentPath = "/instructor/courses/course-1/builder/assignments/as-1";
let search = "";
let navigationType: ReturnType<typeof useNavigationType>;
const Where = () => {
  search = useLocation().search;
  navigationType = useNavigationType();
  return null;
};
const open = (query = "", state?: unknown, previous?: string) =>
  render(
    <MemoryRouter
      initialEntries={[
        ...(previous ? [previous] : []),
        { pathname: "/instructor/submissions", search: query, state },
      ]}
    >
      <Routes>
        <Route path={assignmentPath} element={<h1>Chi tiết bài tập</h1>} />
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

const COURSES = [
  { id: "course-1", name: "Khóa Toán" },
  { id: "course-2", name: "Khóa Văn" },
  { id: "empty-course", name: "Khóa chưa có bài tập" },
];
const ASSIGNMENTS: Record<string, { id: string; title: string }[]> = {
  "course-1": [
    { id: "as-1", title: "Bài luận số 1" },
    { id: "as-2", title: "Bài luận số 2" },
  ],
  "course-2": [{ id: "as-3", title: "Bài thơ" }],
};
const listAnswer = (id: string, courseId: string) =>
  ({
    data: {
      assignment: {
        id,
        courseId,
        title: "Tiêu đề " + id,
        peerReviewEnabled: false,
      },
      statusCounts: {},
      learnerNamesAvailable: true,
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    },
  }) as never;

// antd Select: open the list of the select that shows `current`, then click the option by its title
const choose = async (current: string, option: string) => {
  const box = (await screen.findByText(current)).closest(".ant-select")!;
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
  courses.mockResolvedValue({ data: { result: COURSES } } as never);
  assignments.mockImplementation(
    (courseId: string) =>
      Promise.resolve({
        data: { items: ASSIGNMENTS[courseId] ?? [] },
      }) as never,
  );
  submissions.mockImplementation(((id: string) =>
    Promise.resolve(
      listAnswer(id, id === "as-3" ? "course-2" : "course-1"),
    )) as never);
});
afterEach(cleanup);

describe("Submissions page: Course and Assignment on top", () => {
  it("picks the first Course and its first Assignment by itself and lists its submissions", async () => {
    open();
    await waitFor(() => expect(search).toBe("?assessmentId=as-1"));
    await waitFor(() =>
      expect(submissions).toHaveBeenCalledWith("as-1", expect.anything()),
    );
    expect(await screen.findByText("Khóa Toán")).toBeTruthy();
    expect(await screen.findByText("Bài luận số 1")).toBeTruthy();
  });

  it("changing the Assignment lists the submissions of the new one", async () => {
    open("?assessmentId=as-1");
    await screen.findByText("Bài luận số 1");
    await choose("Bài luận số 1", "Bài luận số 2");
    await waitFor(() => expect(search).toBe("?assessmentId=as-2"));
    await waitFor(() =>
      expect(submissions).toHaveBeenCalledWith("as-2", expect.anything()),
    );
  });

  it("changing the Course moves to the first Assignment of that Course", async () => {
    open("?assessmentId=as-1");
    await screen.findByText("Khóa Toán");
    await choose("Khóa Toán", "Khóa Văn");
    await waitFor(() => expect(assignments).toHaveBeenCalledWith("course-2"));
    await waitFor(() => expect(search).toBe("?assessmentId=as-3"));
    await waitFor(() =>
      expect(submissions).toHaveBeenCalledWith("as-3", expect.anything()),
    );
  });

  it("clears the previous assignment heading when the new Course has no Assignments", async () => {
    open("?assessmentId=as-1");
    expect(
      await screen.findByRole("heading", { name: "Tiêu đề as-1" }),
    ).toBeTruthy();
    await choose("Khóa Toán", "Khóa chưa có bài tập");
    expect(
      await screen.findByText("Khóa học này chưa có bài tập nào."),
    ).toBeTruthy();
    expect(search).toBe("");
    expect(screen.queryByRole("heading", { name: "Tiêu đề as-1" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Bài nộp của bài tập" }),
    ).toBeTruthy();
  });

  it("replaces the filter URL and keeps Back hidden on the sidebar entry", async () => {
    open();
    await screen.findByRole("heading", { name: "Tiêu đề as-1" });
    fireEvent.click(screen.getAllByRole("switch")[0]);
    await waitFor(() => expect(search).toContain("needs=1"));
    expect(navigationType).toBe("REPLACE");
    expect(screen.queryByRole("button", { name: /Quay lại/ })).toBeNull();
  });

  it("returns to the Assignment in one click after applying a filter", async () => {
    // MemoryRouter supplies the entries while the browser index drives the shared Back hook.
    const historyState = window.history.state;
    window.history.replaceState({ idx: 1 }, "");
    try {
      open("?assessmentId=as-1", { fromAssignment: true }, assignmentPath);
      await screen.findByRole("heading", { name: "Tiêu đề as-1" });
      fireEvent.click(screen.getAllByRole("switch")[0]);
      await waitFor(() => expect(search).toContain("needs=1"));
      fireEvent.click(screen.getByRole("button", { name: /Quay lại/ }));
      expect(
        await screen.findByRole("heading", { name: "Chi tiết bài tập" }),
      ).toBeTruthy();
    } finally {
      window.history.replaceState(historyState, "");
    }
  });

  it("an address with an Assignment keeps it and shows its Course", async () => {
    open("?assessmentId=as-3");
    expect(await screen.findByText("Khóa Văn")).toBeTruthy();
    expect(await screen.findByText("Bài thơ")).toBeTruthy();
    expect(search).toBe("?assessmentId=as-3");
  });

  it("says so when the Instructor has no Course", async () => {
    courses.mockResolvedValue({ data: { result: [] } } as never);
    open();
    expect(await screen.findByText("Bạn chưa có khóa học nào.")).toBeTruthy();
    expect(submissions).not.toHaveBeenCalled();
  });

  it("shows an error, not a blank page, when the Assignments cannot be loaded", async () => {
    assignments.mockRejectedValue(new Error("down"));
    open();
    expect(
      await screen.findByText(/Không thể tải danh sách bài tập/),
    ).toBeTruthy();
  });

  it("from the sidebar the Instructor chooses the Course and the Assignment, and there is no Back", async () => {
    open("?assessmentId=as-1");
    await screen.findByText("Bài luận số 1");
    expect(screen.getByText("Khóa học")).toBeTruthy();
    expect(screen.getByText("Khóa Toán")).toBeTruthy();
    expect(screen.queryByText("Quay lại")).toBeNull();
  });

  it("from the Assignment the page is that Assignment's submissions: its title, no selects, and Back", async () => {
    open("?assessmentId=as-1", { fromAssignment: true });
    expect(
      await screen.findByRole("heading", { name: "Tiêu đề as-1" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Bài tập này không bật chấm chéo: bạn chấm mọi bài nộp.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Quay lại")).toBeTruthy();
    // nothing to choose: the Course and Assignment selects are not there, and the lists behind them are not asked for
    expect(screen.queryByText("Khóa học")).toBeNull();
    expect(screen.queryByText("Khóa Toán")).toBeNull();
    expect(courses).not.toHaveBeenCalled();
    expect(assignments).not.toHaveBeenCalled();
    expect(submissions).toHaveBeenCalledWith("as-1", expect.anything());
  });

  it("from the Assignment, filtering keeps the page as it is: still no selects, Back still there", async () => {
    open("?assessmentId=as-1", { fromAssignment: true });
    await screen.findByRole("heading", { name: "Tiêu đề as-1" });
    fireEvent.click(screen.getAllByRole("switch")[0]);
    await waitFor(() => expect(search).toContain("needs=1"));
    expect(screen.getByText("Quay lại")).toBeTruthy();
    expect(screen.queryByText("Khóa học")).toBeNull();
  });
});
