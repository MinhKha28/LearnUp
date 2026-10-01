import type { IntroductionModule } from "@/types/catalog.types";
import type { EnrolledCourseLink } from "@/types/learning.types";
import { formatMinutes } from "@/utils/learner.labels";

/** courseId → enrollmentId, để gắn nhãn "Đã đăng ký" và nút "Vào học" (D5, D48). */
export const buildEnrolledMap = (links: readonly EnrolledCourseLink[]): Map<string, string> =>
  new Map(links.map((link) => [link.courseId, link.enrollmentId]));

export const formatCompletionDays = (days: number | null): string =>
  days === null || !Number.isFinite(days) ? "—" : `Hoàn thành trong ${days} ngày`;

export const formatEstimatedDuration = (minutes: number | null): string => formatMinutes(minutes);

export const formatMaterialCount = (count: number): string => `${count} học liệu`;

/** Module rồi Lesson theo `position`, không đổi mảng gốc. */
export const orderCurriculum = (modules: readonly IntroductionModule[]): IntroductionModule[] =>
  [...modules]
    .sort((a, b) => a.position - b.position)
    .map((module) => ({ ...module, lessons: [...module.lessons].sort((a, b) => a.position - b.position) }));
