/** Đường dẫn màn hình learner; trang trong /learner/courses dùng enrollmentId (D40). */
export const LEARNER_ROUTES = {
  myCourses: () => "/learner/courses",
  catalog: (page?: number) => (page && page > 1 ? `/learner/catalog?page=${page}` : "/learner/catalog"),
  courseIntro: (courseId: string) => `/learner/catalog/${encodeURIComponent(courseId)}`,
  curriculum: (enrollmentId: string) => `/learner/courses/${encodeURIComponent(enrollmentId)}`,
  certificates: () => "/learner/certificates",
  progress: (enrollmentId: string) => `/learner/courses/${encodeURIComponent(enrollmentId)}/progress`,
  evaluation: (enrollmentId: string) => `/learner/courses/${encodeURIComponent(enrollmentId)}/evaluation`,
  lesson: (enrollmentId: string, lessonId: string) =>
    `/learner/courses/${encodeURIComponent(enrollmentId)}/lessons/${encodeURIComponent(lessonId)}`,
};
