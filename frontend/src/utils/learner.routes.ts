/** Đường dẫn màn hình learner; trang trong /learner/courses dùng enrollmentId (D40). */
export const LEARNER_ROUTES = {
  myCourses: () => "/learner/courses",
  catalog: (page?: number, q?: string) => {
    const params = new URLSearchParams();
    if (page && page > 1) params.set("page", String(page));
    if (q) params.set("q", q);
    return "/learner/catalog" + (params.size ? "?" + params.toString() : "");
  },
  courseIntro: (courseId: string) =>
    `/learner/catalog/${encodeURIComponent(courseId)}`,
  curriculum: (enrollmentId: string) =>
    `/learner/courses/${encodeURIComponent(enrollmentId)}`,
  assessments: (enrollmentId: string) =>
    `/learner/courses/${encodeURIComponent(enrollmentId)}/assessments`,
  results: (enrollmentId: string) =>
    `/learner/courses/${encodeURIComponent(enrollmentId)}/results`,
  quiz: (enrollmentId: string, quizId: string) =>
    `/learner/courses/${encodeURIComponent(enrollmentId)}/quizzes/${encodeURIComponent(quizId)}`,
  quizHistory: (enrollmentId: string, quizId: string) =>
    `/learner/courses/${encodeURIComponent(enrollmentId)}/quizzes/${encodeURIComponent(quizId)}/history`,
  assignmentResult: (enrollmentId: string, assignmentId: string) =>
    `/learner/courses/${encodeURIComponent(enrollmentId)}/assignments/${encodeURIComponent(assignmentId)}/result`,
  assignmentSubmit: (enrollmentId: string, assignmentId: string) =>
    `/learner/courses/${encodeURIComponent(enrollmentId)}/assignments/${encodeURIComponent(assignmentId)}/submit`,
  certificates: () => "/learner/certificates",
  progress: (enrollmentId: string) => `/learner/courses/${encodeURIComponent(enrollmentId)}/progress`,
  evaluation: (enrollmentId: string) => `/learner/courses/${encodeURIComponent(enrollmentId)}/evaluation`,
  lesson: (enrollmentId: string, lessonId: string) =>
    `/learner/courses/${encodeURIComponent(enrollmentId)}/lessons/${encodeURIComponent(lessonId)}`,
};
