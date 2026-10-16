import { apiGet, apiPatch, apiPost } from "@/services/api.client";
import type { PageResponse, PageMeta } from "@/types/api.types";
import type { ILearnerListItem } from "@/types/organization.types";
import type { IOrganizationCourseListItem } from "@/types/course.types";
import type {
  AssignmentDetail,
  AssignmentPage,
  AssignmentResult,
} from "@/types/assignment.types";

const path = "/api/v1/assignments";
export const fetchAssignments = (page: number, signal?: AbortSignal) =>
  apiGet<AssignmentPage>(path, { params: { page }, signal });
export const fetchAssignment = (id: string, signal?: AbortSignal) =>
  apiGet<AssignmentDetail>(`${path}/${encodeURIComponent(id)}`, { signal });

export const extendAssignment = (
  id: string,
  newDueDate: string,
  reason: string,
) =>
  apiPatch<AssignmentDetail>(`${path}/${encodeURIComponent(id)}/due-date`, {
    newDueDate,
    reason,
  });
export const exemptAssignment = (id: string, reason: string) =>
  apiPost<AssignmentDetail>(`${path}/${encodeURIComponent(id)}/exemption`, {
    reason,
  });

export const assignCourse = (courseId: string, learnerIds: string[]) =>
  apiPost<AssignmentResult>(path, { courseId, learnerIds });
export const fetchAssignmentLearners = (page: number, signal?: AbortSignal) =>
  apiGet<PageResponse<ILearnerListItem>>("/api/v1/users/learners", {
    params: { page, pageSize: 50 },
    signal,
  });
export const fetchAssignmentCourses = (
  current: number,
  search: string,
  signal?: AbortSignal,
) =>
  apiGet<{ result: IOrganizationCourseListItem[]; meta: PageMeta }>(
    "/api/v1/courses/organization",
    { params: { current, pageSize: 20, status: "Published", search }, signal },
  );
