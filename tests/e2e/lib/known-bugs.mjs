/**
 * Product bugs found by this suite. A step tagged with one of these IDs still asserts the
 * correct business outcome; while the bug exists it is reported as KNOWN-FAIL instead of FAIL.
 * Details and curl reproductions: tests/e2e/README.md#known-failures.
 */
export const KNOWN_BUGS = {
  "ID-1": "identity-service: default username 'user_' + first 8 hex of the UUIDv7 user ID collides for accounts created in the same ~65 s window; the second invitation accept returns 503 IDENTITY_UNAVAILABLE (Identity responds 500)",
  "GW-1": "api-gateway: no route for /api/v1/assignments (learning-service), which the frontend calls through the gateway; returns 404",
  "CT-1": "assessment-service does not implement GET /api/v1/internal/learners/:learnerId/courses/:courseId/completion-snapshot that learning-service's completion worker calls (http mode, the compose default); enrollments never reach Completed",
};
