import type { IContentReport, ReportContentType } from "./learner.data";

export const reportContentTypeLabel: Record<ReportContentType, string> = {
  Lesson: "Bài học",
  Video: "Video",
  Reading: "Tài liệu đọc",
  Quiz: "Bài trắc nghiệm",
  Assignment: "Bài tập",
};

export const reportDecisionLabel: Record<NonNullable<IContentReport["decision"]>, string> = {
  "No violation": "Không vi phạm",
  Confirmed: "Đã xác nhận",
};
