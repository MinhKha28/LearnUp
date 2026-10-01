import type { PageResponse } from "@/types/api.types";

/** Một Course trong danh mục UC25 (CatalogCourseDto của course-service). */
export interface CatalogCourse {
  id: string;
  name: string;
  shortDescription: string | null;
  trainingObjectives: string | null;
  coverFileId: string | null;
  expectedCompletionDays: number;
  /** Phút; null khi chưa tính được (D12). */
  estimatedDurationMinutes: number | null;
}

export type CatalogPage = PageResponse<CatalogCourse>;

export interface IntroductionLesson {
  id: string;
  title: string;
  position: number;
  isRequired: boolean;
  materialCount: number;
}

export interface IntroductionModule {
  id: string;
  title: string;
  position: number;
  isRequired: boolean;
  lessons: IntroductionLesson[];
}

/** Giới thiệu Course UC25.1 (CourseIntroductionDto của course-service). */
export interface CourseIntroduction {
  id: string;
  name: string;
  shortDescription: string | null;
  trainingObjectives: string | null;
  learningOutcomes: string[];
  coverFileId: string | null;
  expectedCompletionDays: number;
  estimatedDurationMinutes: number | null;
  requiredMaterialCount: number;
  modules: IntroductionModule[];
}
