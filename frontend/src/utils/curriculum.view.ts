import { isRetryableError, type ApiError } from "@/types/api.types";
import type { CurriculumData, LessonMaterial } from "@/types/learning.types";
import { summarizeEnrollment, type EnrollmentSummary } from "@/utils/enrollment.summary";
import { formatDuration, MATERIAL_TYPE_LABELS, type StatusTone } from "@/utils/learner.labels";

export type CompletionMark = { label: string; tone: StatusTone } | null;

export const buildCurriculumHeader = (data: CurriculumData): EnrollmentSummary =>
  summarizeEnrollment(data, data.organizationTimezone);

/** null: Lesson hoặc Module không có học liệu, không hiện dấu (D30). */
export const completionMark = (completed: boolean | null): CompletionMark => {
  if (completed === null) return null;
  return completed
    ? { label: "Đã hoàn thành", tone: "success" }
    : { label: "Chưa hoàn thành", tone: "neutral" };
};

export interface MaterialRow {
  key: string;
  title: string;
  typeLabel: string;
  isRequired: boolean;
  duration: string | null;
  mark: CompletionMark;
}

export const buildMaterialRow = (material: LessonMaterial): MaterialRow => ({
  key: material.materialId,
  title: material.title,
  typeLabel: MATERIAL_TYPE_LABELS[material.materialType] ?? material.materialType,
  isRequired: material.isRequired,
  duration:
    material.materialType === "Video" && material.durationSeconds !== null
      ? formatDuration(material.durationSeconds)
      : null,
  mark: completionMark(material.completed),
});

export interface LearningErrorView {
  title: string;
  description: string | null;
  action: "myCourses" | "curriculum" | "retry" | null;
}

const GENERIC_TITLES = {
  curriculum: "Không tải được chương trình học",
  lesson: "Không tải được Lesson",
} as const;

/** Thông báo theo error.code cho UC27, UC27.1 (D28, D32); không dùng message của server. */
export const mapLearningError = (error: ApiError, context: "curriculum" | "lesson"): LearningErrorView => {
  switch (error.code) {
    case "ENROLLMENT_NOT_FOUND":
      return {
        title: "Không tìm thấy Course",
        description: "Course không tồn tại hoặc không thuộc danh sách Course của bạn.",
        action: "myCourses",
      };
    case "CONTENT_UNAVAILABLE":
      return { title: "Course đang tạm dừng, bạn chưa thể truy cập nội dung", description: null, action: "myCourses" };
    case "LESSON_NOT_FOUND":
      return {
        title: "Không tìm thấy Lesson",
        description: "Lesson không thuộc chương trình học của Course này.",
        action: "curriculum",
      };
    case "LESSON_DISABLED":
      return { title: "Lesson này đang tạm ngưng", description: null, action: "curriculum" };
  }
  if (isRetryableError(error)) {
    return {
      title: GENERIC_TITLES[context],
      description: "Không tải được dữ liệu. Vui lòng thử lại.",
      action: "retry",
    };
  }
  return { title: GENERIC_TITLES[context], description: "Đã có lỗi xảy ra.", action: null };
};
