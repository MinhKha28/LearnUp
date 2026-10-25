/** Chạy mọi test tích hợp bằng node:test trong một tiến trình: npm run test:integration */
import './tenant-lookup-config';
import './course-service-client.integration-test';
import './enrollments.integration-test';
import './enrollment-rate-limit.integration-test';
import './base-due-at.integration-test';
import './my-enrollments.integration-test';
import './curriculum.integration-test';
import './demo-reset.integration-test';
import './assignments.integration-test';
import './assignment-reads.integration-test';
import './assignment-changes.integration-test';
import './optional-withdrawal.integration-test';
import './learner-enrollment-summary.integration-test';
import './video-progress.integration-test';
import './outbox-relay.integration-test';

import './assessment-access.integration-test';
import './course-completion.integration-test';
import './reading-completion.integration-test';
