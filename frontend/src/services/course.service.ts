import { courseAxios as axios } from "@/services/axios.customize";

import type {
  ICourseDetail,
  ICourseLesson,
  ICourseListQuery,
  ICourseModule,
  ICourseStructure,
  ICourseTrashItem,
  ICreateCourseLessonRequest,
  ICreateCourseModuleRequest,
  ICreateCourseRequest,
  ICreateCourseResponse,
  ICreateReadingMaterialRequest,
  ICreateReadingMaterialResponse,
  ICreateVideoMaterialRequest,
  ICreateVideoMaterialResponse,
  IInstructorCourseListItem,
  IInstructorLessonDetail,
  ILessonContentEditability,
  IMaterialPreview,
  IOrganizationCourseFilterInstructor,
  IOrganizationCourseListItem,
  IOrganizationCourseListQuery,
  IPermanentDeleteCourseResult,
  IOrganizerCourseReview,
  IReadingUploadContext,
  IRestoreCourseResult,
  ISubmitCourseResponse,
  IWithdrawCourseResponse,
  ISoftDeleteCourseResult,
  ITechnicalReplacementResponse,
  IUpdateCourseRequest,
  IUpdateCourseResponse,
  IUpdateCourseStructureRequest,
  IUpdateCourseStructureResponse,
  IUpdateLessonContentRequest,
  IUpdateLessonContentResponse,
  IUpdateMaterialRequest,
  IUpdateMaterialResponse,
  IUploadCourseCoverResponse,
  IVideoUploadContext,
} from "@/types/course.types";
import type { AxiosProgressEvent } from "axios";

export const fetchManagedCoursesAPI = (query: ICourseListQuery) =>
  axios.get<IBackendRes<IModelPaginate<IInstructorCourseListItem>>>(
    "/api/v1/courses",
    {
      params: query,
    },
  );

export const createCourseAPI = (payload: ICreateCourseRequest) =>
  axios.post<IBackendRes<ICreateCourseResponse>>("/api/v1/courses", payload);

export const uploadCourseCoverAPI = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return axios.post<IBackendRes<IUploadCourseCoverResponse>>(
    "/api/v1/courses/cover",
    formData,
  );
};

export const fetchCourseStructureAPI = (courseId: string) =>
  axios.get<IBackendRes<ICourseStructure>>(
    `/api/v1/courses/${courseId}/structure`,
  );

export const createCourseModuleAPI = (
  courseId: string,
  payload: ICreateCourseModuleRequest,
) =>
  axios.post<IBackendRes<ICourseModule>>(
    `/api/v1/courses/${courseId}/modules`,
    payload,
  );

export const createCourseLessonAPI = (
  courseId: string,
  moduleId: string,
  payload: ICreateCourseLessonRequest,
) =>
  axios.post<IBackendRes<ICourseLesson>>(
    `/api/v1/courses/${courseId}/modules/${moduleId}/lessons`,
    payload,
  );

export const fetchOrganizationCoursesAPI = (
  query: IOrganizationCourseListQuery,
) =>
  axios.get<IBackendRes<IModelPaginate<IOrganizationCourseListItem>>>(
    "/api/v1/courses/organization",
    {
      params: query,
    },
  );

export const fetchOrganizationCourseInstructorsAPI = () =>
  axios.get<IBackendRes<IOrganizationCourseFilterInstructor[]>>(
    "/api/v1/courses/organization/instructors",
  );

export const fetchCourseDetailAPI = (courseId: string) =>
  axios.get<IBackendRes<ICourseDetail>>(`/api/v1/courses/${courseId}`);

export const updateCourseAPI = (
  courseId: string,
  payload: IUpdateCourseRequest,
) =>
  axios.put<IBackendRes<IUpdateCourseResponse>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}`,
    payload,
  );

export const updateCourseStructureAPI = (
  courseId: string,
  payload: IUpdateCourseStructureRequest,
) =>
  axios.put<IBackendRes<IUpdateCourseStructureResponse>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/structure`,
    payload,
  );

export const fetchCourseLessonDetailAPI = (
  courseId: string,
  lessonId: string,
  signal?: AbortSignal,
) =>
  axios.get<IBackendRes<IInstructorLessonDetail>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
    { signal },
  );

export const fetchLessonContentEditabilityAPI = (
  courseId: string,
  lessonId: string,
  signal?: AbortSignal,
) =>
  axios.get<IBackendRes<ILessonContentEditability>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/content-editability`,
    { signal },
  );

export const updateLessonContentAPI = (
  courseId: string,
  lessonId: string,
  payload: IUpdateLessonContentRequest,
) =>
  axios.put<IBackendRes<IUpdateLessonContentResponse>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/content`,
    payload,
  );

export const fetchVideoUploadContextAPI = (
  courseId: string,
  lessonId: string,
  signal?: AbortSignal,
) =>
  axios.get<IBackendRes<IVideoUploadContext>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/materials/video-upload-context`,
    { signal },
  );

export const createVideoMaterialAPI = (
  courseId: string,
  lessonId: string,
  payload: ICreateVideoMaterialRequest,
  onUploadProgress?: (event: AxiosProgressEvent) => void,
) => {
  const formData = new FormData();

  formData.append("title", payload.title);
  formData.append("isRequired", String(payload.isRequired));
  formData.append("file", payload.file);

  return axios.post<IBackendRes<ICreateVideoMaterialResponse>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/materials/videos`,
    formData,
    {
      onUploadProgress,
      timeout: 15 * 60 * 1000,
    },
  );
};

export const fetchReadingUploadContextAPI = (
  courseId: string,
  lessonId: string,
  signal?: AbortSignal,
) =>
  axios.get<IBackendRes<IReadingUploadContext>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/materials/reading-upload-context`,
    { signal },
  );

export const createReadingMaterialAPI = (
  courseId: string,
  lessonId: string,
  payload: ICreateReadingMaterialRequest,
  onUploadProgress?: (event: AxiosProgressEvent) => void,
) => {
  const formData = new FormData();

  formData.append("title", payload.title);
  formData.append("isRequired", String(payload.isRequired));
  formData.append("file", payload.file);

  return axios.post<IBackendRes<ICreateReadingMaterialResponse>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/materials/readings`,
    formData,
    {
      onUploadProgress,
      timeout: 120000,
    },
  );
};

/**
 * UC14.5 - Move a Course to Trash.
 */
export const softDeleteCourseAPI = (courseId: string) =>
  axios.delete<IBackendRes<ISoftDeleteCourseResult>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}`,
  );

/**
 * UC14.5 - Get the current Instructor's deleted Courses.
 */
export const fetchCourseTrashAPI = () =>
  axios.get<IBackendRes<ICourseTrashItem[]>>("/api/v1/courses/trash");

/**
 * UC14.5 - Restore a Course from Trash.
 */
export const restoreCourseAPI = (courseId: string) =>
  axios.post<IBackendRes<IRestoreCourseResult>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/restore`,
  );

/**
 * UC14.5 - Permanently delete a Course in Trash.
 */
export const permanentDeleteCourseAPI = (courseId: string) =>
  axios.delete<IBackendRes<IPermanentDeleteCourseResult>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/permanent`,
  );

export const submitCourseForApprovalAPI = (courseId: string) =>
  axios.post<IBackendRes<ISubmitCourseResponse>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/submit`,
  );

export const withdrawCourseSubmissionAPI = (courseId: string) =>
  axios.post<IBackendRes<IWithdrawCourseResponse>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/withdraw`,
  );

export const updateMaterialAPI = (
  courseId: string,
  lessonId: string,
  materialId: string,
  payload: IUpdateMaterialRequest,
) =>
  axios.patch<IBackendRes<IUpdateMaterialResponse>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}` +
      `/lessons/${encodeURIComponent(lessonId)}` +
      `/materials/${encodeURIComponent(materialId)}`,
    payload,
  );

export const replaceTechnicalMaterialAPI = (
  courseId: string,
  lessonId: string,
  materialId: string,
  file: File,
  onUploadProgress?: (event: AxiosProgressEvent) => void,
) => {
  const formData = new FormData();
  formData.append("file", file);

  return axios.post<IBackendRes<ITechnicalReplacementResponse>>(
    `/api/v1/courses/${encodeURIComponent(courseId)}` +
      `/lessons/${encodeURIComponent(lessonId)}` +
      `/materials/${encodeURIComponent(materialId)}` +
      `/technical-replacement`,
    formData,
    {
      onUploadProgress,
      timeout: 15 * 60 * 1000,
    },
  );
};

export const fetchOrganizerCourseReviewAPI = (courseId: string) =>
  axios.get<IBackendRes<IOrganizerCourseReview>>(
    `/api/v1/courses/organization/${encodeURIComponent(courseId)}/review`,
  );

export const fetchOrganizerMaterialPreviewAPI = (
  courseId: string,
  materialId: string,
) =>
  axios.get<IBackendRes<IMaterialPreview>>(
    `/api/v1/courses/organization/${encodeURIComponent(courseId)}/materials/${encodeURIComponent(materialId)}/preview`,
  );
