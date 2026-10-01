import type { MyEnrollmentItem } from "@/types/learning.types";
import { formatDueAt } from "@/utils/due.format";
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_TYPE_LABELS, type StatusTone } from "@/utils/learner.labels";
import { LEARNER_ROUTES } from "@/utils/learner.routes";

export const HALTED_NOTE = "Course đang tạm dừng, bạn chưa thể truy cập nội dung";

const UNKNOWN_STATUS = { label: "Không xác định", tone: "neutral" as StatusTone };

export interface MyCourseRow {
  key: string;
  title: string;
  /** Có khi course-service trả được Course; dùng cho aria-label của ảnh bìa. */
  courseName: string | null;
  coverFileId: string | null;
  versionLabel: string | null;
  typeLabel: string;
  status: { label: string; tone: StatusTone };
  due: { text: string; isDeviceTime: boolean } | null;
  progress: string | null;
  action: { kind: "open"; to: string } | { kind: "halted"; note: string };
}

/** Mô hình hiển thị một dòng UC26; không tính phần trăm (D4). */
export const buildMyCourseRow = (item: MyEnrollmentItem, organizationTimezone: string | null): MyCourseRow => {
  const { completed, total } = item.requiredMaterials;
  return {
    key: item.enrollmentId,
    title: item.course?.name ?? "Không tải được thông tin Course",
    courseName: item.course?.name ?? null,
    coverFileId: item.course?.coverFileId ?? null,
    versionLabel: item.course ? `Phiên bản ${item.course.versionNumber}` : null,
    typeLabel: ENROLLMENT_TYPE_LABELS[item.enrollmentType] ?? item.enrollmentType,
    status: ENROLLMENT_STATUS_LABELS[item.status] ?? UNKNOWN_STATUS,
    due:
      item.enrollmentType === "Required" && item.dueAt !== null
        ? formatDueAt(item.dueAt, organizationTimezone)
        : null,
    progress: total > 0 ? `Học liệu bắt buộc ${completed}/${total}` : null,
    action:
      item.status === "Halted"
        ? { kind: "halted", note: HALTED_NOTE }
        : { kind: "open", to: LEARNER_ROUTES.curriculum(item.enrollmentId) },
  };
};
