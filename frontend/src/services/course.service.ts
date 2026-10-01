import axios from "@/services/axios.customize";

import type {
  ICourseListQuery,
  ICreateCourseRequest,
  ICreateCourseResponse,
  IInstructorCourseListItem,
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
