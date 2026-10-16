import { apiGet } from "@/services/api.client";
import type {
  AssignmentDetail,
  AssignmentPage,
} from "@/types/assignment.types";

const path = "/api/v1/assignments";
export const fetchAssignments = (page: number, signal?: AbortSignal) =>
  apiGet<AssignmentPage>(path, { params: { page }, signal });
export const fetchAssignment = (id: string, signal?: AbortSignal) =>
  apiGet<AssignmentDetail>(`${path}/${encodeURIComponent(id)}`, { signal });
