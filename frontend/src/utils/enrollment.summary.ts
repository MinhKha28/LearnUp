import { formatDueAt } from "@/utils/due.format";
import {
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_TYPE_LABELS,
  type EnrollmentStatus,
  type EnrollmentType,
  type StatusTone,
} from "@/utils/learner.labels";

const UNKNOWN_STATUS = { label: "Không xác định", tone: "neutral" as StatusTone };

export interface EnrollmentSummarySource {
  enrollmentType: EnrollmentType;
  status: EnrollmentStatus;
  dueAt: string | null;
  requiredMaterials: { completed: number; total: number };
  course: { name: string; versionNumber: number } | null;
}

export interface EnrollmentSummary {
  title: string;
  courseName: string | null;
  versionLabel: string | null;
  typeLabel: string;
  status: { label: string; tone: StatusTone };
  due: { text: string; isDeviceTime: boolean } | null;
  progress: string | null;
}

/** Phần mô tả Enrollment dùng chung cho UC26 và phần đầu UC27 (D4, D24–D27). */
export const summarizeEnrollment = (
  source: EnrollmentSummarySource,
  organizationTimezone: string | null,
): EnrollmentSummary => {
  const { completed, total } = source.requiredMaterials;
  return {
    title: source.course?.name ?? "Không tải được thông tin Khóa học",
    courseName: source.course?.name ?? null,
    versionLabel: source.course ? `Phiên bản ${source.course.versionNumber}` : null,
    typeLabel: ENROLLMENT_TYPE_LABELS[source.enrollmentType] ?? source.enrollmentType,
    status: ENROLLMENT_STATUS_LABELS[source.status] ?? UNKNOWN_STATUS,
    due:
      source.enrollmentType === "Required" && source.dueAt !== null
        ? formatDueAt(source.dueAt, organizationTimezone)
        : null,
    progress: total > 0 ? `Học liệu bắt buộc ${completed}/${total}` : null,
  };
};
