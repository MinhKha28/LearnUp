import { courseAxios as axios } from "@/services/axios.customize";

import type {
  ICourseDetail,
  ICourseLesson,
  ICourseListQuery,
  ICourseModule,
  ICourseStructure,
  ICreateCourseLessonRequest,
  ICreateCourseModuleRequest,
  ICreateCourseRequest,
  ICreateCourseResponse,
  IInstructorCourseListItem,
  IOrganizationCourseFilterInstructor,
  IOrganizationCourseListItem,
  IOrganizationCourseListQuery,
  IUploadCourseCoverResponse,
} from "@/types/course.types";

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
