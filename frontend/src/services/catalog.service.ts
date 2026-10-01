import { API_PATHS, apiGet } from "@/services/api.client";
import type { CatalogPage, CourseIntroduction } from "@/types/catalog.types";

export const fetchCatalog = (page: number, signal?: AbortSignal) =>
  apiGet<CatalogPage>(API_PATHS.catalog, { params: { page }, signal });

export const fetchCourseIntroduction = (courseId: string, signal?: AbortSignal) =>
  apiGet<CourseIntroduction>(API_PATHS.courseIntroduction(courseId), { signal });
