import { describe, expect, it } from "vitest";
import { courseStatusLabel, gradingHighlights } from "./instructor.data";

describe("Instructor Vietnamese display labels", () => {
  it("shows localized course statuses without changing status keys", () => {
    expect(courseStatusLabel).toEqual({
      draft: "Bản nháp",
      submitted: "Chờ phê duyệt",
      rejected: "Bị từ chối",
      published: "Đã phát hành",
    });
  });

  it("shows Vietnamese grading action labels", () => {
    expect(gradingHighlights.map((item) => item.label)).toEqual([
      "Bài nộp cần chấm trực tiếp",
      "Chu kỳ chấm chéo sắp đến hạn",
      "Xem các bài có điểm chênh lệch",
    ]);
  });
});
