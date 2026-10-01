export type CourseType = "PUBLIC" | "PRIVATE";

export type CourseStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED"
  | "DISABLED";

export interface IInstructorCourseListItem {
  id: string;
  chainId: string;
  versionNumber: number;
  name: string;
  courseType: CourseType;
  status: CourseStatus;
  locked: boolean;
  learnerCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICourseListQuery {
  current?: number;
  pageSize?: number;
  search?: string;
  courseType?: CourseType;
  status?: CourseStatus;
  locked?: boolean;
}
