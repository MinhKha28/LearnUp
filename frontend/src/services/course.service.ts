import axios from "@/services/axios.customize";

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
      headers: {
        "x-internal-key": "learnup-internal-secret",
        "x-user-id": "33333333-3333-7333-8333-333333333333",
        "x-organization-id": "22222222-2222-7222-8222-222222222222",
        "x-user-role": "INSTRUCTOR",
      },
    },
  );

export const createCourseAPI = (payload: ICreateCourseRequest) =>
  axios.post<IBackendRes<ICreateCourseResponse>>("/api/v1/courses", payload, {
    headers: {
      "x-internal-key": "learnup-internal-secret",
      "x-user-id": "33333333-3333-7333-8333-333333333333",
      "x-organization-id": "22222222-2222-7222-8222-222222222222",
      "x-user-role": "INSTRUCTOR",
    },
  });

export const uploadCourseCoverAPI = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  return axios.post<IBackendRes<IUploadCourseCoverResponse>>(
    "/api/v1/courses/cover",
    formData,
    {
      headers: {
        "x-internal-key": "learnup-internal-secret",
        "x-user-id": "33333333-3333-7333-8333-333333333333",
        "x-organization-id": "22222222-2222-7222-8222-222222222222",
        "x-user-role": "INSTRUCTOR",
      },
    },
  );
};

export const fetchCourseStructureAPI = (courseId: string) =>
  axios.get<IBackendRes<ICourseStructure>>(
    `/api/v1/courses/${courseId}/structure`,
    {
      headers: {
        "x-internal-key": "learnup-internal-secret",
        "x-user-id": "33333333-3333-7333-8333-333333333333",
        "x-organization-id": "22222222-2222-7222-8222-222222222222",
        "x-user-role": "INSTRUCTOR",
      },
    },
  );

export const createCourseModuleAPI = (
  courseId: string,
  payload: ICreateCourseModuleRequest,
) =>
  axios.post<IBackendRes<ICourseModule>>(
    `/api/v1/courses/${courseId}/modules`,
    payload,
    {
      headers: {
        "x-internal-key": "learnup-internal-secret",
        "x-user-id": "33333333-3333-7333-8333-333333333333",
        "x-organization-id": "22222222-2222-7222-8222-222222222222",
        "x-user-role": "INSTRUCTOR",
      },
    },
  );

export const createCourseLessonAPI = (
  courseId: string,
  moduleId: string,
  payload: ICreateCourseLessonRequest,
) =>
  axios.post<IBackendRes<ICourseLesson>>(
    `/api/v1/courses/${courseId}/modules/${moduleId}/lessons`,
    payload,
    {
      headers: {
        "x-internal-key": "learnup-internal-secret",
        "x-user-id": "33333333-3333-7333-8333-333333333333",
        "x-organization-id": "22222222-2222-7222-8222-222222222222",
        "x-user-role": "INSTRUCTOR",
      },
    },
  );

export const fetchOrganizationCoursesAPI = (
  query: IOrganizationCourseListQuery,
) =>
  axios.get<IBackendRes<IModelPaginate<IOrganizationCourseListItem>>>(
    "/api/v1/courses/organization",
    {
      params: query,
      headers: {
        "x-internal-key": "learnup-internal-secret",
        "x-user-id": "44444444-4444-7444-8444-444444444440",
        "x-organization-id": "22222222-2222-7222-8222-222222222222",
        "x-user-role": "ORGANIZER",
      },
    },
  );

export const fetchOrganizationCourseInstructorsAPI = () =>
  axios.get<IBackendRes<IOrganizationCourseFilterInstructor[]>>(
    "/api/v1/courses/organization/instructors",
    {
      headers: {
        "x-internal-key": "learnup-internal-secret",
        "x-user-id": "44444444-4444-7444-8444-444444444440",
        "x-organization-id": "22222222-2222-7222-8222-222222222222",
        "x-user-role": "ORGANIZER",
      },
    },
  );

export const fetchCourseDetailAPI = (courseId: string) =>
  axios.get<IBackendRes<ICourseDetail>>(`/api/v1/courses/${courseId}`, {
    headers: {
      "x-internal-key": "learnup-internal-secret",
      "x-user-id": "33333333-3333-7333-8333-333333333333",
      "x-organization-id": "22222222-2222-7222-8222-222222222222",
      "x-user-role": "INSTRUCTOR",
    },
  });
