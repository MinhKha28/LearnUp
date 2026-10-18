import type { CourseStatus, CourseType } from "./course.values";
export type { CourseStatus, CourseType } from "./course.values";
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

export interface ICourseDetail {
  id: string;
  chainId: string;
  versionNumber: number;
  name: string;
  shortDescription: string | null;
  trainingObjectives: string | null;
  learningOutcomes: string[];
  coverFileId: string | null;
  coverUrl: string | null;
  expectedCompletionDays: number;
  estimatedDurationMinutes: number | null;
  courseType: CourseType;
  status: CourseStatus;
  locked: boolean;
  submittedAt: string | null;
  publishedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IUpdateCourseRequest {
  name: string;
  shortDescription: string | null;
  trainingObjectives: string | null;
  learningOutcomes: string[];
  coverFileId: string | null;
  expectedCompletionDays: number;
  courseType: CourseType;
}

export interface IUpdateCourseResponse extends ICourseDetail {
  courseTypeChanged: boolean;
}

export interface IUpdateStructureLesson {
  id: string;
  title: string;
}

export interface IUpdateStructureModule {
  id: string;
  title: string;
  lessons: IUpdateStructureLesson[];
}

export interface IUpdateCourseStructureRequest {
  modules: IUpdateStructureModule[];
}

export interface IUpdateCourseStructureResponse {
  updated: boolean;
  titleChanged: boolean;
  orderChanged: boolean;
}

export interface IInstructorLessonMaterial {
  id: string;
  fileId: string; // UC17
  title: string;
  materialType: string;
  isRequired: boolean;
  position: number;
  disabledAt: string | null;

  file: {
    originalFilename: string;
    mimeType: string;
    sizeBytes: string;
    durationSeconds: number | null;
    wordCount: number | null;
    status: string;
    releasedAt: string | null;
  };
}

export interface IInstructorLessonDetail {
  course: {
    id: string;
    name: string;
    status: CourseStatus;
    locked: boolean;
  };

  module: {
    id: string;
    title: string;
    position: number;
  };

  lesson: {
    id: string;
    title: string;
    content: string;
    position: number;
    disabledAt: string | null;
    required: boolean;
  };

  materials: IInstructorLessonMaterial[];
}

export interface ILessonContentEditability {
  canEdit: boolean;
  reason: "COMPLETED" | "SUBMITTED" | null;
}

export interface IUpdateLessonContentRequest {
  content: string;
}

export interface IUpdateLessonContentResponse {
  id: string;
  content: string;
}
