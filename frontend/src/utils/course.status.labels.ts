import type { CourseStatus } from "@/types/course.types";

export const courseStatusLabel: Record<CourseStatus, string> = {
  Draft: "Bản nháp",
  Submitted: "Chờ phê duyệt",
  Published: "Đã phát hành",
  Rejected: "Bị từ chối",
  Archived: "Đã lưu trữ",
  Disabled: "Đã vô hiệu hóa",
};
