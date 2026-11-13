// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCurriculum, fetchEnrollmentProgress } from "@/services/learning.service";
import { fetchLearnerAssessmentsAPI } from "@/services/assessment.service";
import type { EnrollmentProgress } from "@/types/learning.types";
import { ApiError } from "@/types/api.types";
import CourseProgress from "./course.progress";

vi.mock("@/services/learning.service", () => ({
  fetchEnrollmentProgress: vi.fn(),
  fetchCurriculum: vi.fn(),
}));
vi.mock("@/services/assessment.service", () => ({
  fetchLearnerAssessmentsAPI: vi.fn(),
}));
const curriculum = vi.mocked(fetchCurriculum);
const progress = vi.mocked(fetchEnrollmentProgress);
const assessments = vi.mocked(fetchLearnerAssessmentsAPI);
const deviceTimezone = process.env.TZ;
const refreshNotice = "Chưa cập nhật được tiến độ mới nhất. Đang hiển thị dữ liệu lần tải trước.";
const heading = "Tiến độ hoàn thành khóa học";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

const focus = () => fireEvent(window, new Event("focus"));
const fixture = (): EnrollmentProgress => ({
  enrollment: {
    id: "enrollment",
    courseId: "course",
    status: "InProgress",
    enrollmentType: "Required",
    dueAt: "2026-11-02T17:00:00Z",
    dueTimezone: "Asia/Ho_Chi_Minh",
    completedAt: null,
    completedLate: null,
  },
  materials: [
    {
      materialId: "m",
      lessonId: "lesson",
      title: "Đọc tài liệu an toàn",
      materialType: "Reading",
      required: true,
      done: false,
    },
  ],
  assessment: {
    state: "ok",
    items: [
      { kind: "quiz", assessmentId: "q", passed: false, peerReview: null },
      {
        kind: "assignment",
        assessmentId: "a",
        passed: true,
        peerReview: {
          status: "Pending",
          requiredCount: 2,
          completedCount: 1,
          done: false,
        },
      },
    ],
  },
  conditions: {
    state: "ok",
    met: 1,
    total: 4,
    missing: [
      { kind: "material", id: "m" },
      { kind: "quiz", id: "q" },
      { kind: "peerReview", id: "a" },
    ],
  },
});
const mount = () =>
  render(
    <MemoryRouter initialEntries={["/learner/courses/enrollment/progress"]}>
      <Link to="/learner/courses/other-enrollment/progress">Khóa học khác</Link>
      <Routes>
        <Route
          path="/learner/courses/:enrollmentId/progress"
          element={<CourseProgress />}
        />
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  process.env.TZ = "Asia/Ho_Chi_Minh";
  vi.resetAllMocks();
  progress.mockResolvedValue(fixture());
  curriculum.mockResolvedValue({ course: { name: "An toàn lao động", versionNumber: 1 } } as never);
  assessments.mockResolvedValue({
    data: {
      items: [
        { id: "q", title: "Kiểm tra an toàn" },
        { id: "a", title: "Bài thực hành" },
      ],
    },
  } as never);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (deviceTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = deviceTimezone;
});
describe("UC28 real progress page", () => {
  it("shows the course name from the existing curriculum endpoint and labels the assignment type", async () => {
    mount();
    await screen.findByText("An toàn lao động");
    expect(curriculum).toHaveBeenCalledWith("enrollment", expect.any(AbortSignal));
    expect(screen.getByText("Loại phân công: Bắt buộc")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Về chương trình học" }).getAttribute("href"))
      .toBe("/learner/courses/enrollment");
  });
  it.each(["missing", "unavailable"])("keeps the heading when the course name is %s", async (state) => {
    if (state === "missing") curriculum.mockResolvedValue({ course: null } as never);
    else curriculum.mockRejectedValue(new ApiError(503, "SERVICE_UNAVAILABLE", ""));
    mount();
    await screen.findByText("Điều kiện hoàn thành: 1/4 đã đạt");
    await waitFor(() => expect(curriculum).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("heading", { name: "Tiến độ hoàn thành khóa học" })).toBeTruthy();
    expect(screen.queryByText("An toàn lao động")).toBeNull();
  });

  it("shows counts, a complete missing list, joined names and due date without percentage", async () => {
    const { container } = mount();
    await screen.findByText("Điều kiện hoàn thành: 1/4 đã đạt");
    await screen.findByText("Đạt điểm yêu cầu: Kiểm tra an toàn");
    const assessmentSection = screen.getByRole("region", { name: "Bài trắc nghiệm và bài tập" });
    expect(within(assessmentSection).getByRole("heading", { name: "Bài trắc nghiệm và bài tập" })).toBeTruthy();
    const missing = screen.getByRole("region", { name: "Điều kiện còn thiếu" });
    expect(within(missing).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(missing).getByText("Hoàn thành chấm chéo: Bài thực hành"),
    ).toBeTruthy();
    expect(
      within(missing).getByText("Đọc tài liệu an toàn").getAttribute("href"),
    ).toContain("/lessons/lesson");
    expect(
      screen.getByText("Hạn hoàn thành: Hết ngày 02/11/2026"),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("%");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(progress).toHaveBeenCalledWith(
      "enrollment",
      expect.any(AbortSignal),
    );
    expect(assessments).toHaveBeenCalledWith("course", expect.any(AbortSignal));
  });
  it("keeps materials when Assessment is unavailable and retries the endpoint", async () => {
    const degraded = fixture();
    degraded.assessment = { state: "unavailable" };
    degraded.conditions = {
      state: "unavailable",
      met: null,
      total: null,
      missing: [{ kind: "material", id: "m" }],
    };
    progress.mockResolvedValueOnce(degraded).mockResolvedValue(fixture());
    mount();
    await screen.findByText("Chưa tải được thông tin bài trắc nghiệm và bài tập");
    expect(
      screen.getByRole("region", { name: "Học liệu" }).textContent,
    ).toContain("Đọc tài liệu an toàn");
    expect(screen.queryByText(/Điều kiện hoàn thành:/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Điều kiện hoàn thành: 1/4 đã đạt");
    expect(progress).toHaveBeenCalledTimes(2);
  });
  it("Completed shows only stored summary and post-completion links, with no assessment list call", async () => {
    progress.mockResolvedValue({
      enrollment: {
        ...fixture().enrollment,
        status: "Completed",
        dueTimezone: "America/New_York",
        completedAt: "2026-11-03T00:00:00Z",
        completedLate: true,
      },
    });
    mount();
    await screen.findByText("Đã hoàn thành");
    expect(screen.getByText("Ngày hoàn thành: 03/11/2026 07:00")).toBeTruthy();
    expect(screen.getByText("Hoàn thành sau hạn")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Xem chứng chỉ" }).getAttribute("href"),
    ).toBe("/learner/certificates");
    expect(screen.queryByRole("link", { name: "Đánh giá khóa học" })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Điều kiện còn thiếu" }),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Học liệu" })).toBeNull();
    expect(assessments).not.toHaveBeenCalled();
  });
  for (const [code, status, text] of [
    [
      "CONTENT_UNAVAILABLE",
      403,
      "Khóa học đang tạm dừng, bạn chưa thể truy cập nội dung",
    ],
    ["ENROLLMENT_NOT_FOUND", 404, "Không tìm thấy khóa học"],
  ] as const) {
    it(`reuses curriculum error mapping for ${code}`, async () => {
      progress.mockRejectedValue(new ApiError(status, code, ""));
      mount();
      await screen.findByText(text);
      expect(assessments).not.toHaveBeenCalled();
    });
  }
  it("shows the initial skeleton until progress first resolves", async () => {
    const pending = deferred<EnrollmentProgress>();
    progress.mockReturnValueOnce(pending.promise);
    mount();

    expect(screen.getByRole("status", { name: "Đang tải" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: heading })).toBeNull();
    await act(async () => pending.resolve(fixture()));
    expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Đang tải" })).toBeNull();
  });

  it("keeps the same details mounted and course name visible during a refresh", async () => {
    const pending = deferred<EnrollmentProgress>();
    progress.mockResolvedValueOnce(fixture()).mockReturnValueOnce(pending.promise);
    mount();

    const title = await screen.findByRole("heading", { name: heading });
    await screen.findByText("An toàn lao động");
    focus();

    expect(progress).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: heading })).toBe(title);
    expect(screen.getByText("An toàn lao động")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Đang tải" })).toBeNull();
    await act(async () => pending.resolve(fixture()));
    expect(screen.getByRole("heading", { name: heading })).toBe(title);
    expect(curriculum).toHaveBeenCalledTimes(1);
  });

  it("clears the previous enrollment immediately when the route changes", async () => {
    const pending = deferred<EnrollmentProgress>();
    progress.mockResolvedValueOnce(fixture()).mockReturnValueOnce(pending.promise);
    mount();
    await screen.findByText("An toàn lao động");

    fireEvent.click(screen.getByRole("link", { name: "Khóa học khác" }));

    expect(screen.getByRole("status", { name: "Đang tải" })).toBeTruthy();
    expect(screen.queryByText("An toàn lao động")).toBeNull();
    expect(screen.queryByRole("heading", { name: heading })).toBeNull();
    expect(progress).toHaveBeenLastCalledWith("other-enrollment", expect.any(AbortSignal));
    const next = fixture();
    next.enrollment.id = "other-enrollment";
    await act(async () => pending.resolve(next));
    expect(screen.getByRole("link", { name: "Về chương trình học" }).getAttribute("href"))
      .toBe("/learner/courses/other-enrollment");
  });

  it.each([
    [403, "CONTENT_UNAVAILABLE", "Khóa học đang tạm dừng, bạn chưa thể truy cập nội dung"],
    [404, "ENROLLMENT_NOT_FOUND", "Không tìm thấy khóa học"],
  ] as const)("replaces an existing snapshot when refresh returns %s", async (status, code, text) => {
    const pending = deferred<EnrollmentProgress>();
    progress.mockResolvedValueOnce(fixture())
      .mockRejectedValueOnce(new ApiError(status, code, ""))
      .mockReturnValueOnce(pending.promise);
    mount();
    await screen.findByRole("heading", { name: heading });

    focus();
    await screen.findByText(text);
    expect(screen.queryByRole("heading", { name: heading })).toBeNull();
    expect(screen.queryByText(refreshNotice)).toBeNull();

    focus();
    expect(screen.getByRole("status", { name: "Đang tải" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: heading })).toBeNull();
  });

  it.each([
    new ApiError(503, "SERVICE_UNAVAILABLE", ""),
    new ApiError(0, "NETWORK", ""),
  ])("keeps the snapshot with a retry notice after a temporary $code error", async (error) => {
    const pending = deferred<EnrollmentProgress>();
    progress.mockResolvedValueOnce(fixture())
      .mockRejectedValueOnce(error)
      .mockReturnValueOnce(pending.promise);
    mount();
    const title = await screen.findByRole("heading", { name: heading });

    focus();
    const notice = await screen.findByRole("alert");
    expect(within(notice).getByText(refreshNotice)).toBeTruthy();
    expect(screen.getByRole("heading", { name: heading })).toBe(title);

    fireEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
    expect(progress).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("heading", { name: heading })).toBe(title);
    expect(screen.queryByRole("status", { name: "Đang tải" })).toBeNull();
    await act(async () => pending.resolve(fixture()));
    expect(screen.queryByText(refreshNotice)).toBeNull();
  });

  it("shows the full error and retries when there is no snapshot", async () => {
    progress.mockRejectedValueOnce(new ApiError(503, "SERVICE_UNAVAILABLE", ""));
    mount();

    const error = await screen.findByRole("alert");
    expect(within(error).getByText("Không tải được dữ liệu. Vui lòng thử lại.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: heading })).toBeNull();
    fireEvent.click(within(error).getByRole("button", { name: "Thử lại" }));
    await screen.findByRole("heading", { name: heading });
    expect(progress).toHaveBeenCalledTimes(2);
  });

  it("ignores a slow focus response after a newer visibility response", async () => {
    const older = deferred<EnrollmentProgress>();
    const newer = deferred<EnrollmentProgress>();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    progress.mockResolvedValueOnce(fixture())
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    mount();
    await screen.findByText("Đang học");

    focus();
    fireEvent(document, new Event("visibilitychange"));
    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress.mock.calls[1][1]?.aborted).toBe(true);
    const updated = fixture();
    updated.enrollment.status = "Overdue";
    await act(async () => newer.resolve(updated));
    expect(screen.getByText("Quá hạn").classList).toContain("learner-status-error");
    await act(async () => older.resolve(fixture()));
    expect(screen.getByText("Quá hạn")).toBeTruthy();
    expect(screen.queryByText("Đang học")).toBeNull();
  });

  it("fetches assessment titles once per eligible enrollment and course", async () => {
    mount();
    await screen.findByText("Đạt điểm yêu cầu: Kiểm tra an toàn");
    const updated = fixture();
    updated.enrollment.status = "Overdue";
    progress.mockResolvedValueOnce(updated);
    focus();
    await screen.findByText("Quá hạn");
    expect(assessments).toHaveBeenCalledTimes(1);

    const anotherCourse = fixture();
    anotherCourse.enrollment.courseId = "another-course";
    progress.mockResolvedValueOnce(anotherCourse);
    focus();
    await waitFor(() => expect(assessments).toHaveBeenCalledTimes(2));
    expect(assessments).toHaveBeenLastCalledWith("another-course", expect.any(AbortSignal));
  });

  it("links an unmatched material to the curriculum and leaves assessment links intact", async () => {
    const data = fixture();
    data.conditions?.missing.push({ kind: "material", id: "missing" });
    progress.mockResolvedValueOnce(data);
    mount();

    const missing = await screen.findByRole("region", { name: "Điều kiện còn thiếu" });
    expect(within(missing).getByRole("link", { name: "Một Học liệu bắt buộc khác (xem trong chương trình học)" }).getAttribute("href"))
      .toBe("/learner/courses/enrollment");
    expect(within(missing).getByRole("link", { name: "Đọc tài liệu an toàn" }).getAttribute("href"))
      .toBe("/learner/courses/enrollment/lessons/lesson");
    expect((await within(missing).findByRole("link", { name: "Đạt điểm yêu cầu: Kiểm tra an toàn" })).getAttribute("href"))
      .toBe("/learner/courses/enrollment/assessments");
  });

  it("aborts pending title requests on cleanup without clearing titles or surfacing an error", async () => {
    const { unmount } = mount();
    const title = "Đạt điểm yêu cầu: Kiểm tra an toàn";
    await screen.findByText(title);

    assessments.mockImplementation((_courseId, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const anotherCourse = fixture();
    anotherCourse.enrollment.courseId = "another-course";
    progress.mockResolvedValueOnce(anotherCourse);
    focus();
    await waitFor(() => expect(assessments).toHaveBeenCalledTimes(2));
    const superseded = assessments.mock.calls[1][1];
    progress.mockResolvedValueOnce(fixture());
    focus();
    await waitFor(() => expect(assessments).toHaveBeenCalledTimes(3));
    expect(superseded?.aborted).toBe(true);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    const pending = assessments.mock.calls[2][1];
    await act(async () => unmount());
    expect(pending?.aborted).toBe(true);
  });

  it("falls back to Vietnamese generic names if the assessment list fails", async () => {
    assessments.mockRejectedValue(new Error("unavailable"));
    mount();
    await screen.findByText("Đạt điểm yêu cầu: Bài trắc nghiệm");
    await waitFor(() => expect(assessments).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Hoàn thành chấm chéo: Bài tập")).toBeTruthy();
  });
});
