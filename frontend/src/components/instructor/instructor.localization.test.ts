import { describe, expect, it } from "vitest";
import { courseStatusLabel, gradingHighlights, dueStatusMessage, monitoringCompletionLabel, monitoringDueLabel, monitoringEnrollmentLabel } from "./instructor.data";

describe("Instructor Vietnamese display labels", () => {
  it("shows localized course statuses without changing status keys", () => {
    expect(courseStatusLabel).toEqual({
      draft: "Bản nháp",
      submitted: "Chờ phê duyệt",
      rejected: "Bị từ chối",
      published: "Đã phát hành",
    });
  });

  it("keeps monitoring status keys while localizing display values", () => {
    expect(monitoringEnrollmentLabel.Required).toBe("Bắt buộc");
    expect(monitoringCompletionLabel["In progress"]).toBe("Đang học");
    expect(monitoringDueLabel.Overdue).toBe("Quá hạn");
    expect(dueStatusMessage["No deadline"]).toContain("Học viên vẫn có thể tiếp tục học");
  });

  it("shows Vietnamese grading action labels", () => {
    expect(gradingHighlights.map((item) => item.label)).toEqual([
      "Bài nộp cần chấm trực tiếp",
      "Chu kỳ chấm chéo sắp đến hạn",
      "Xem các bài có điểm chênh lệch",
    ]);
  });
});
