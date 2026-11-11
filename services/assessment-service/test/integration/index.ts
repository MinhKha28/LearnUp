/**
 * Run every integration test with node:test in one process: npm run test:integration
 * Needs Postgres (DATABASE_URL); each file makes and drops its own throw-away database, and the service is
 * started from dist/ (the npm script builds first).
 */
import './assignments.integration-test';
import './course-client-modes.integration-test';
import './seed-reseed.integration-test';
import './prompt-file.integration-test';
import './quiz.integration-test';
import './quiz-detail.integration-test';
import './quiz-question.integration-test';
import './learner-submissions.integration-test';
import './learner-assessments.integration-test';
import './learner-resubmissions.integration-test';
import './learner-results.integration-test';
import './instructor-finalization.integration-test';
import './peer-review-cycles.integration-test';
import './assessment-activity.integration-test';
import './assignment-minutes.integration-test';
import './withdrawal-demo-seed.integration-test';
import './peer-review-close.integration-test';
import './peer-review-schedule.integration-test';
import './peer-review-status-events.integration-test';
import './peer-review-waiver.integration-test';
import './learner-peer-review.integration-test';
import './learner-peer-review-storage.integration-test';
import './cycle-score-gap.integration-test';
import './enrollment-status.integration-test';
import './completion-snapshot.integration-test';
import './outbox-relay.integration-test';
import './outbox-kafka.integration-test';
import './learner-review-history.integration-test';
import './quiz-take.integration-test';
import './quiz-take-kafka.integration-test';
import './assessment-results.integration-test';
import './instructor-submission-search.integration-test';
