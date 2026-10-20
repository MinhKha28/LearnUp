import type { MyEnrollmentItem } from "@/types/learning.types";
import { summarizeEnrollment, type EnrollmentSummary } from "@/utils/enrollment.summary";
import { LEARNER_ROUTES } from "@/utils/learner.routes";

export const HALTED_NOTE = "Khóa học đang tạm dừng, bạn chưa thể truy cập nội dung";

export interface MyCourseRow extends EnrollmentSummary {
  key: string;
  coverFileId: string | null;
  action: { kind: "open"; to: string } | { kind: "halted"; note: string };
}

/** Mô hình hiển thị một dòng UC26; không tính phần trăm (D4). */
export const buildMyCourseRow = (item: MyEnrollmentItem, organizationTimezone: string | null): MyCourseRow => ({
  key: item.enrollmentId,
  ...summarizeEnrollment(item, organizationTimezone),
  coverFileId: item.course?.coverFileId ?? null,
  action:
    item.status === "Halted"
      ? { kind: "halted", note: HALTED_NOTE }
      : { kind: "open", to: LEARNER_ROUTES.curriculum(item.enrollmentId) },
});
