import { describe, expect, it } from "vitest";

import type { MyEnrollmentItem } from "@/types/learning.types";
import { buildMyCourseRow, HALTED_NOTE } from "@/utils/my.courses.view";

const TZ = "Asia/Ho_Chi_Minh";

const item = (overrides: Partial<MyEnrollmentItem>): MyEnrollmentItem => ({
  enrollmentId: "0199a000-0000-7000-8000-2a0000000002",
  courseId: "0199a000-0000-7000-8000-0e0000000002",
  enrollmentType: "Required",
  status: "Overdue",
  dueAt: "2026-09-29T17:00:00.000Z",
  dueTimezone: TZ,
  requiredMaterials: { completed: 1, total: 6 },
  course: { name: "An toàn lao động", versionNumber: 1, coverFileId: null },
  ...overrides,
});

describe("buildMyCourseRow", () => {
  it("formats the same instant with each item's frozen timezone", () => {
    const dueAt = "2026-10-29T17:00:00.000Z";
    expect(buildMyCourseRow(item({ dueAt, dueTimezone: "Asia/Ho_Chi_Minh" })).due?.text).toBe("Hết ngày 29/10/2026");
    expect(buildMyCourseRow(item({ dueAt, dueTimezone: "Pacific/Auckland" })).due?.text).toBe("06:00 30/10/2026");
  });

  it("Required Overdue, hạn đã qua", () => {
    expect(buildMyCourseRow(item({}))).toEqual({
      key: "0199a000-0000-7000-8000-2a0000000002",
      title: "An toàn lao động",
      courseName: "An toàn lao động",
      coverFileId: null,
      versionLabel: "Phiên bản 1",
      typeLabel: "Bắt buộc",
      status: { label: "Quá hạn", tone: "error" },
      due: { text: "Hết ngày 29/09/2026", isDeviceTime: false },
      progress: "Học liệu bắt buộc 1/6",
      action: { kind: "open", to: "/learner/courses/0199a000-0000-7000-8000-2a0000000002" },
    });
  });

  it("Required NotStarted, hạn tương lai", () => {
    const row = buildMyCourseRow(
      item({
        enrollmentId: "0199a000-0000-7000-8000-2a0000000001",
        status: "NotStarted",
        dueAt: "2026-10-11T17:00:00.000Z",
        requiredMaterials: { completed: 0, total: 5 },
        course: { name: "Quy trình vận hành", versionNumber: 2, coverFileId: null },
      }),
    );
    expect(row.status).toEqual({ label: "Chưa bắt đầu", tone: "neutral" });
    expect(row.due).toEqual({ text: "Hết ngày 11/10/2026", isDeviceTime: false });
    expect(row.progress).toBe("Học liệu bắt buộc 0/5");
    expect(row.versionLabel).toBe("Phiên bản 2");
  });

  it("Optional không có dòng hạn", () => {
    const row = buildMyCourseRow(item({ enrollmentType: "Optional", status: "InProgress", dueAt: null }));
    expect(row.typeLabel).toBe("Tự chọn");
    expect(row.status).toEqual({ label: "Đang học", tone: "info" });
    expect(row.due).toBeNull();
  });

  it("Optional có dueAt vẫn không hiện hạn", () => {
    expect(buildMyCourseRow(item({ enrollmentType: "Optional" })).due).toBeNull();
  });

  it("course null vẫn hiện dòng (D26)", () => {
    const row = buildMyCourseRow(item({ course: null }));
    expect(row.title).toBe("Không tải được thông tin Khóa học");
    expect(row.courseName).toBeNull();
    expect(row.versionLabel).toBeNull();
    expect(row.action.kind).toBe("open");
  });

  it("y = 0 ẩn tiến độ (D25)", () => {
    expect(buildMyCourseRow(item({ requiredMaterials: { completed: 0, total: 0 } })).progress).toBeNull();
  });

  it("Completed vẫn hiện số thật", () => {
    const row = buildMyCourseRow(item({ status: "Completed", requiredMaterials: { completed: 6, total: 6 } }));
    expect(row.status).toEqual({ label: "Đã hoàn thành", tone: "success" });
    expect(row.progress).toBe("Học liệu bắt buộc 6/6");
  });

  it("Halted không có nút vào học", () => {
    const row = buildMyCourseRow(item({ status: "Halted" }));
    expect(row.status).toEqual({ label: "Tạm dừng", tone: "warning" });
    expect(row.action).toEqual({ kind: "halted", note: HALTED_NOTE });
    expect(HALTED_NOTE).toBe("Khóa học đang tạm dừng, bạn chưa thể truy cập nội dung");
  });

  it("dueTimezone null → giờ máy kèm nhãn", () => {
    expect(buildMyCourseRow(item({ dueAt: "2026-10-11T17:00:00.000Z", dueTimezone: null })).due).toEqual({
      text: "00:00 12/10/2026 (giờ trên máy bạn, GMT+7)",
      isDeviceTime: true,
    });
  });

  it("trạng thái lạ không làm vỡ màn hình", () => {
    const row = buildMyCourseRow(item({ status: "Archived" as MyEnrollmentItem["status"] }));
    expect(row.status).toEqual({ label: "Không xác định", tone: "neutral" });
  });
});
