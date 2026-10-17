/**
 * Run every integration test with node:test in one process: npm run test:integration
 * Needs Postgres (DATABASE_URL); each file makes and drops its own throw-away database, and the service is
 * started from dist/ (the npm script builds first).
 */
import './assignments.integration-test';
import './course-client-modes.integration-test';
import './prompt-file.integration-test';
import './quiz.integration-test';
import './learner-submissions.integration-test';
import './learner-assessments.integration-test';
import './learner-resubmissions.integration-test';
import './learner-results.integration-test';
