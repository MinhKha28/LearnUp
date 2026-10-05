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

export interface ICreateCourseRequest {
  name: string;
  shortDescription?: string;
  trainingObjectives?: string;
  learningOutcomes?: string[];
  coverFileId?: string;
  expectedCompletionDays: number;
  courseType: CourseType;
}

export interface ICreateCourseResponse {
  id: string;
  chainId: string;
  versionNumber: number;
  name: string;
  shortDescription?: string | null;
  trainingObjectives?: string | null;
  learningOutcomes: string[];
  coverFileId?: string | null;
  expectedCompletionDays: number;
  courseType: CourseType;
  status: CourseStatus;
  locked: boolean;
  learnerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICourseStructureLesson {
  id: string;
  title: string;
  position: number;
  required: boolean;
}

export interface ICourseStructureModule {
  id: string;
  title: string;
  position: number;
  required: boolean;
  lessons: ICourseStructureLesson[];
}

export interface ICourseStructureCourse {
  id: string;
  name: string;
  versionNumber: number;
  status: CourseStatus;
  locked: boolean;
}

export interface ICourseStructure {
  course: ICourseStructureCourse;
  structureLocked: boolean;
  lockReason: string | null;
  modules: ICourseStructureModule[];
}

export interface ICreateCourseModuleRequest {
  title: string;
}

export interface ICourseModule {
  id: string;
  courseId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateCourseLessonRequest {
  title: string;
  content: string;
}

export interface ICourseLesson {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface IOrganizationCourseInstructor {
  id: string;
  fullName: string;
}

export interface IOrganizationCourseListItem {
  id: string;
  chainId: string;
  versionNumber: number;
  name: string;
  courseType: CourseType;
  status: CourseStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  instructor: IOrganizationCourseInstructor;
  learnerCount: number;
}

export interface IOrganizationCourseListQuery {
  current?: number;
  pageSize?: number;
}

export interface IOrganizationCourseInstructor {
  id: string;
  fullName: string;
}

export interface IOrganizationCourseListItem {
  id: string;
  chainId: string;
  versionNumber: number;
  name: string;
  courseType: CourseType;
  status: CourseStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  instructor: IOrganizationCourseInstructor;
  learnerCount: number;
}

export interface IOrganizationCourseListQuery {
  current?: number;
  pageSize?: number;
  search?: string;
  courseType?: CourseType;
  status?: CourseStatus;
  instructorId?: string;
  submittedFrom?: string;
  submittedTo?: string;
}

export interface IOrganizationCourseFilterInstructor {
  id: string;
  fullName: string;
}

export interface IUploadCourseCoverResponse {
  fileId: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}
