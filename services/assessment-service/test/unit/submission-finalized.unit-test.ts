import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from 'generated/prisma/client';
import {
  emitSubmissionFinalized,
  SUBMISSION_FINALIZED_EVENT,
} from '../../src/modules/outbox/submission-finalized';
import {
  readRelayConfig,
  topicOf,
  topicsOf,
} from '../../src/modules/outbox/relay.config';
import { RELAYED_EVENT_TYPES } from '../../src/modules/outbox/relay.repository';

const event = {
  organizationId: 'org',
  learnerId: 'learner',
  submissionId: 'submission',
  assessmentId: 'assignment',
  assessmentTitle: 'Assignment',
  courseId: 'course',
  finalScore: 66.67,
};
const now = new Date('2026-11-23T01:02:03.000Z');
test('finalized payload has exactly the contract fields, decimal strings and the finalization timestamp', async () => {
  let data: any;
  const tx = {
    outboxEvent: {
      create: (args: any) => {
        data = args.data;
        return Promise.resolve();
      },
    },
  } as unknown as Prisma.TransactionClient;
  await emitSubmissionFinalized(tx, event, now);
  assert.deepEqual(data, {
    aggregateType: 'Submission',
    aggregateId: event.submissionId,
    eventType: SUBMISSION_FINALIZED_EVENT,
    organizationId: event.organizationId,
    occurredAt: now,
    payload: {
      learnerId: event.learnerId,
      submissionId: event.submissionId,
      assessmentId: event.assessmentId,
      assessmentTitle: event.assessmentTitle,
      finalScore: '66.67',
      maxScore: '100.00',
      courseId: event.courseId,
      finalizedAt: now.toISOString(),
    },
  });
});
test('whole scores retain two decimal places and failed inserts propagate to the transaction', async () => {
  const tx = {
    outboxEvent: {
      create: ({ data }: any) => {
        assert.equal(data.payload.finalScore, '80.00');
        return Promise.reject(new Error('insert rejected'));
      },
    },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(
    emitSubmissionFinalized(tx, { ...event, finalScore: 80 }, now),
    /insert rejected/,
  );
});
test('relay includes finalized events and provisions their dedicated configurable topic', () => {
  const config = readRelayConfig((key) =>
    key === 'OUTBOX_SUBMISSION_FINALIZED_TOPIC' ? 'test.finalized' : undefined,
  );
  assert.ok(RELAYED_EVENT_TYPES.includes(SUBMISSION_FINALIZED_EVENT));
  assert.equal(topicOf(SUBMISSION_FINALIZED_EVENT, config), 'test.finalized');
  assert.ok(topicsOf(config).includes('test.finalized'));
  assert.throws(() =>
    readRelayConfig((key) =>
      key === 'OUTBOX_SUBMISSION_FINALIZED_TOPIC' ? 'bad topic' : undefined,
    ),
  );
  assert.throws(() =>
    readRelayConfig((key) =>
      key === 'OUTBOX_SUBMISSION_FINALIZED_TOPIC' ? config.topic : undefined,
    ),
  );
});

import { InstructorSubmissionsService } from '../../src/modules/instructor-submissions/instructor-submissions.service';
import type { InstructorSubmissionsRepository } from '../../src/modules/instructor-submissions/instructor-submissions.repository';
import type { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import { FakeTenantDirectoryClient } from '../../src/infrastructure/clients/tenant/fake-tenant-directory.client';
import { instructor, MemoryStorage } from './fixtures';

function finalizer(status = 'AwaitingFinalization') {
  const rows: any[] = [];
  const tx = {
    outboxEvent: {
      create: ({ data }: any) => {
        rows.push(data);
        return Promise.resolve();
      },
    },
  };
  const repository = {
    findSubmissionCourse: () =>
      Promise.resolve({
        assessmentId: 'assignment',
        learnerId: 'learner',
        assessment: {
          kind: 'ASSIGNMENT',
          courseId: 'course',
          title: 'Assignment',
        },
      }),
    transaction: (work: any) => Promise.resolve(work(tx)),
    lockAssignmentLearner: async () => {},
    lockSubmission: async () => {},
    findSubmissionForGrading: () =>
      Promise.resolve({
        gradingStatus: status,
        submissionNumber: 1,
        reviews: [{ status: 'Completed', score: 80 }],
      }),
    findLatestSubmissionNumber: () => Promise.resolve(1),
    findLearnerStateId: () => Promise.resolve({ id: 'state' }),
    publishFinalization: async () => {},
    emitSignal: async () => {},
  } as unknown as InstructorSubmissionsRepository;
  const courses = {
    getAuthoringContext: () =>
      Promise.resolve({
        organizationId: instructor.organizationId,
        instructorId: instructor.userId,
      }),
  } as unknown as CourseServiceClient;
  return {
    rows,
    service: new InstructorSubmissionsService(
      repository,
      courses,
      new FakeTenantDirectoryClient(),
      new MemoryStorage(),
    ),
  };
}
test('rejected finalize creates no notice row', async () => {
  const { service, rows } = finalizer('Finalized');
  await assert.rejects(
    service.finalize(instructor, 'submission', { finalScore: 80 }),
  );
  assert.equal(rows.length, 0);
});
test('each successfully finalized submission gets its own row without a notification client', async () => {
  const { service, rows } = finalizer();
  await service.finalize(instructor, 'first', { finalScore: 80 });
  await service.finalize(instructor, 'replacement', { finalScore: 80 });
  assert.deepEqual(
    rows.map((row) => row.payload.submissionId),
    ['first', 'replacement'],
  );
});
