import { describe, expect, it } from "vitest";
import {
  accountStatusText,
  courseStatusText,
  courseTypeText,
  enrollmentKindText,
  materialTypeText,
  questionTypeText,
} from "@/utils/organizer.labels";

describe("organizer display labels", () => {
  it("maps API values to Vietnamese without changing the values", () => {
    expect(courseStatusText("Submitted")).toBe("Chờ phê duyệt");
    expect(courseStatusText("Published")).toBe("Đã phát hành");
    expect(courseTypeText("Public")).toBe("Công khai");
    expect(enrollmentKindText("Required")).toBe("Bắt buộc");
    expect(enrollmentKindText("Optional")).toBe("Tự chọn");
    expect(accountStatusText("Deactivated")).toBe("Đã vô hiệu hóa");
    expect(questionTypeText("TrueFalse")).toBe("Đúng/Sai");
    expect(materialTypeText("Reading")).toBe("Tài liệu đọc");
    expect(materialTypeText("Video")).toBe("Video");
  });

  it("falls back to Không xác định for unknown codes and a dash for empty", () => {
    expect(courseStatusText("Something")).toBe("Không xác định");
    expect(courseStatusText(null)).toBe("—");
  });
});

import { canExemptAssignment, canExtendAssignment } from "@/utils/assignments.view";

describe("assignments.view keeps API enum values", () => {
  it("compares against wire statuses, not display text", () => {
    expect(canExemptAssignment({ status: "Overdue", firstActivityAt: "2026-11-01T00:00:00Z" } as never)).toBe(true);
    expect(canExtendAssignment("Completed")).toBe(false);
    expect(canExtendAssignment("InProgress")).toBe(true);
  });
});

describe("organizer labels fallback", () => {
  it("never leaks an unknown raw value", () => {
    expect(accountStatusText("Weird")).toBe("Không xác định");
    expect(enrollmentKindText("Weird")).toBe("Không xác định");
    expect(questionTypeText("Weird")).toBe("Không xác định");
    expect(materialTypeText("Weird")).toBe("Không xác định");
  });
});
