import { describe, expect, it } from "vitest";

import { ApiError } from "@/types/api.types";
import type { CurriculumData, LessonMaterial } from "@/types/learning.types";
import { buildCurriculumHeader, buildMaterialRow, completionMark, mapLearningError } from "@/utils/curriculum.view";

const curriculum = (overrides: Partial<CurriculumData>): CurriculumData => ({
  enrollmentId: "0199a000-0000-7000-8000-2a0000000002",
  courseId: "0199a000-0000-7000-8000-0e0000000002",
  enrollmentType: "Required",
  status: "Overdue",
  dueAt: "2026-09-29T17:00:00.000Z",
  organizationTimezone: "Asia/Ho_Chi_Minh",
  requiredMaterials: { completed: 1, total: 6 },
  course: { name: "An toàn lao động", versionNumber: 2 },
  modules: [],
  ...overrides,
});

const material = (overrides: Partial<LessonMaterial>): LessonMaterial => ({
  materialId: "m-1",
  title: "Video giới thiệu",
  materialType: "Video",
  isRequired: true,
  durationSeconds: 125,
  completed: false,
  ...overrides,
});

describe("buildCurriculumHeader", () => {
  it("Required Overdue với hạn theo múi giờ Organization", () => {
    expect(buildCurriculumHeader(curriculum({}))).toEqual({
      title: "An toàn lao động",
      courseName: "An toàn lao động",
      versionLabel: "Phiên bản 2",
      typeLabel: "Bắt buộc",
      status: { label: "Quá hạn", tone: "error" },
      due: { text: "Hết ngày 29/09/2026", isDeviceTime: false },
      progress: "Học liệu bắt buộc 1/6",
    });
  });

  it("Required NotStarted hạn tương lai", () => {
    const header = buildCurriculumHeader(
      curriculum({ status: "NotStarted", dueAt: "2026-10-11T17:00:00.000Z", requiredMaterials: { completed: 0, total: 5 } }),
    );
    expect(header.status).toEqual({ label: "Chưa bắt đầu", tone: "neutral" });
    expect(header.due?.text).toBe("Hết ngày 11/10/2026");
    expect(header.progress).toBe("Học liệu bắt buộc 0/5");
  });

  it("Optional không có hạn, y = 0 ẩn tiến độ", () => {
    const header = buildCurriculumHeader(
      curriculum({ enrollmentType: "Optional", status: "InProgress", dueAt: null, requiredMaterials: { completed: 0, total: 0 } }),
    );
    expect(header.typeLabel).toBe("Tự chọn");
    expect(header.due).toBeNull();
    expect(header.progress).toBeNull();
  });

  it("course null (D26)", () => {
    const header = buildCurriculumHeader(curriculum({ course: null }));
    expect(header.title).toBe("Không tải được thông tin Course");
    expect(header.versionLabel).toBeNull();
  });

  it("organizationTimezone null → giờ máy", () => {
    expect(buildCurriculumHeader(curriculum({ organizationTimezone: null, dueAt: "2026-10-11T17:00:00.000Z" })).due).toEqual({
      text: "00:00 12/10/2026 (giờ trên máy bạn, GMT+7)",
      isDeviceTime: true,
    });
  });
});

describe("completionMark", () => {
  it("ba trạng thái", () => {
    expect(completionMark(true)).toEqual({ label: "Đã hoàn thành", tone: "success" });
    expect(completionMark(false)).toEqual({ label: "Chưa hoàn thành", tone: "neutral" });
    expect(completionMark(null)).toBeNull();
  });
});

describe("buildMaterialRow", () => {
  it("Video bắt buộc có thời lượng", () => {
    expect(buildMaterialRow(material({}))).toEqual({
      key: "m-1",
      title: "Video giới thiệu",
      typeLabel: "Video",
      isRequired: true,
      duration: "2 phút",
      mark: { label: "Chưa hoàn thành", tone: "neutral" },
    });
  });

  it("Video chưa có thời lượng thì không hiện", () => {
    expect(buildMaterialRow(material({ durationSeconds: null })).duration).toBeNull();
  });

  it("Bài đọc không hiện thời lượng", () => {
    const row = buildMaterialRow(
      material({ materialType: "Reading", title: "Đọc thêm", durationSeconds: 300, isRequired: false, completed: true }),
    );
    expect(row.typeLabel).toBe("Bài đọc");
    expect(row.duration).toBeNull();
    expect(row.isRequired).toBe(false);
    expect(row.mark).toEqual({ label: "Đã hoàn thành", tone: "success" });
  });
});

describe("mapLearningError", () => {
  it("ENROLLMENT_NOT_FOUND → về Course của tôi", () => {
    expect(mapLearningError(new ApiError(404, "ENROLLMENT_NOT_FOUND", "x"), "curriculum")).toMatchObject({
      title: "Không tìm thấy Course",
      action: "myCourses",
    });
  });

  it("CONTENT_UNAVAILABLE → về Course của tôi", () => {
    expect(mapLearningError(new ApiError(403, "CONTENT_UNAVAILABLE", "x"), "lesson")).toEqual({
      title: "Course đang tạm dừng, bạn chưa thể truy cập nội dung",
      description: null,
      action: "myCourses",
    });
  });

  it("LESSON_NOT_FOUND → về chương trình học", () => {
    expect(mapLearningError(new ApiError(404, "LESSON_NOT_FOUND", "x"), "lesson")).toMatchObject({
      title: "Không tìm thấy Lesson",
      action: "curriculum",
    });
  });

  it("LESSON_DISABLED → về chương trình học", () => {
    expect(mapLearningError(new ApiError(403, "LESSON_DISABLED", "x"), "lesson")).toEqual({
      title: "Lesson này đang tạm ngưng",
      description: null,
      action: "curriculum",
    });
  });

  it.each([
    [0, "NETWORK"],
    [0, "TIMEOUT"],
    [502, "HTTP_502"],
    [503, "SERVICE_UNAVAILABLE"],
    [504, "HTTP_504"],
  ])("%i %s → Thử lại", (status, code) => {
    expect(mapLearningError(new ApiError(status, code, "x"), "curriculum")).toEqual({
      title: "Không tải được chương trình học",
      description: "Không tải được dữ liệu. Vui lòng thử lại.",
      action: "retry",
    });
  });

  it.each([
    [500, "INTERNAL_ERROR"],
    [401, "HTTP_401"],
    [403, "FORBIDDEN"],
    [400, "VALIDATION_FAILED"],
  ])("%i %s → không Thử lại", (status, code) => {
    expect(mapLearningError(new ApiError(status, code, "x"), "lesson")).toEqual({
      title: "Không tải được Lesson",
      description: "Đã có lỗi xảy ra.",
      action: null,
    });
  });
});
