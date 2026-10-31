/**
 * Product bugs found by this suite. A step tagged with one of these IDs still asserts the
 * correct business outcome; while the bug exists it is reported as KNOWN-FAIL instead of FAIL.
 * Details and curl reproductions: tests/e2e/README.md#known-failures.
 */
export const KNOWN_BUGS = {
  "CT-1": "assessment-service does not implement GET /api/v1/internal/learners/:learnerId/courses/:courseId/completion-snapshot that learning-service's completion worker calls (http mode, the compose default); enrollments never reach Completed",
  "UI-1": "UC28 progress page renders hardcoded learner.data mock (frontend/src/pages/learner/course.progress.tsx:~35); blank for real enrollments, no link from the curriculum (owner Hào)",
};
