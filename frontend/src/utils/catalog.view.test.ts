import { describe, expect, it } from "vitest";

import {
  buildEnrolledMap,
  formatCompletionDays,
  formatEstimatedDuration,
  formatMaterialCount,
  orderCurriculum,
} from "@/utils/catalog.view";

describe("buildEnrolledMap", () => {
  it("ghép courseId → enrollmentId", () => {
    const map = buildEnrolledMap([
      { courseId: "c-2", enrollmentId: "e-2" },
      { courseId: "c-4", enrollmentId: "e-1" },
    ]);
    expect(map.get("c-2")).toBe("e-2");
    expect(map.get("c-4")).toBe("e-1");
    expect(map.has("c-3")).toBe(false);
  });

  it("danh sách rỗng → map rỗng", () => {
    expect(buildEnrolledMap([]).size).toBe(0);
  });
});

describe("định dạng", () => {
  it("số ngày hoàn thành", () => {
    expect(formatCompletionDays(14)).toBe("Hoàn thành trong 14 ngày");
    expect(formatCompletionDays(null)).toBe("—");
  });

  it("thời lượng ước tính dùng formatMinutes (D12)", () => {
    expect(formatEstimatedDuration(null)).toBe("—");
    expect(formatEstimatedDuration(45)).toBe("45 phút");
    expect(formatEstimatedDuration(150)).toBe("2 giờ 30 phút");
  });

  it("số học liệu", () => {
    expect(formatMaterialCount(3)).toBe("3 học liệu");
    expect(formatMaterialCount(0)).toBe("0 học liệu");
  });
});

describe("orderCurriculum", () => {
  it("sắp Module và Lesson theo position, không đổi mảng gốc", () => {
    const lesson = (id: string, position: number) => ({ id, title: id, position, isRequired: false, materialCount: 1 });
    const modules = [
      { id: "m2", title: "m2", position: 2, isRequired: false, lessons: [lesson("l2", 2), lesson("l1", 1)] },
      { id: "m1", title: "m1", position: 1, isRequired: true, lessons: [] },
    ];
    const ordered = orderCurriculum(modules);
    expect(ordered.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(ordered[1].lessons.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(modules[0].id).toBe("m2");
    expect(modules[0].lessons[0].id).toBe("l2");
  });
});
