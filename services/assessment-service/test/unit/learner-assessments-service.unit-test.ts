/** Business rules of UC29 (view the Assessments of an enrolled Course), with the database and other services faked. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import {
  type AssessmentAccess,
  type AssessmentAccessLevel,
  EnrollmentClient,
} from '../../src/infrastructure/clients/learning/enrollment.client';
import { LearnerAssessmentsService } from '../../src/modules/learner-assessments/learner-assessments.service';
import type { LearnerAssessmentsRepository } from '../../src/modules/learner-assessments/learner-assessments.repository';
import { COURSE, ORG, rejectsWith } from './fixtures';

const LEARNER = '00000000-0000-4000-8000-0000000000c1';
const ENROLLMENT = '00000000-0000-4000-8000-0000000000e1';
const MODULE_A = '00000000-0000-4000-8000-00000000aa01';
const MODULE_B = '00000000-0000-4000-8000-00000000aa02';
const NOW = new Date('2026-10-15T00:00:00Z');
const HOUR = 3_600_000;

const learner: CurrentUser = {
  userId: LEARNER,
  organizationId: ORG,
  role: 'LEARNER',
  isAuthenticated: true,
};

interface Row {
  id: string;
  kind: 'QUIZ' | 'ASSIGNMENT';
  title: string;
  moduleId: string | null;
  position: number;
  isRequired: boolean;
  passingScore: { toString: () => string };
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  timeLimitMinutes: number | null;
  expectedDurationMinutes: number | null;
}

let seq = 0;
const row = (over: Partial<Row>): Row => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
  kind: 'QUIZ',
  title: 'Quiz',
  moduleId: null,
  position: 1,
  isRequired: false,
  passingScore: { toString: () => '70' },
  maxConsecutiveAttempts: 3,
  lockoutHours: 24,
  timeLimitMinutes: 20,
  expectedDurationMinutes: null,
  ...over,
});
const assignment = (over: Partial<Row> = {}) =>
  row({
    kind: 'ASSIGNMENT',
    title: 'Assignment',
    isRequired: false, // the column is not used for Assignments (BR-206)
    timeLimitMinutes: null,
    expectedDurationMinutes: 60,
    ...over,
  });

interface World {
  rows: Row[];
  states: Record<string, unknown>[];
  attempts: {
    assessmentId: string;
    submittedAt: Date | null;
    score: unknown;
  }[];
  submissions: {
    assessmentId: string;
    submittedAt: Date;
    gradingStatus: string;
    finalScore: unknown;
  }[];
  access: AssessmentAccessLevel;
  enrolled: boolean;
  moduleIds: string[] | null | 'down';
}

function build(over: Partial<World> = {}) {
  const world: World = {
    rows: [],
    states: [],
    attempts: [],
    submissions: [],
    access: 'Full',
    enrolled: true,
    moduleIds: [MODULE_A, MODULE_B],
    ...over,
  };
  const repository = {
    findAssessments: () => Promise.resolve(world.rows),
    findStates: () => Promise.resolve(world.states),
    findQuizAttempts: () => Promise.resolve(world.attempts),
    findLatestSubmissions: () => Promise.resolve(world.submissions),
  } as unknown as LearnerAssessmentsRepository;

  class StubEnrollments extends EnrollmentClient {
    getAssessmentAccess(): Promise<AssessmentAccess | null> {
      return Promise.resolve(
        world.enrolled
          ? {
              enrollmentId: ENROLLMENT,
              status: world.access === 'ReadOnly' ? 'Completed' : 'InProgress',
              access: world.access,
            }
          : null,
      );
    }
  }
  class StubCourses extends CourseServiceClient {
    getAuthoringContext(): never {
      throw new Error('not used');
    }
    setAssignmentMinutes(): Promise<void> {
    return Promise.resolve();
  }
  getModuleIds(): Promise<string[] | null> {
      if (world.moduleIds === 'down') {
        return Promise.reject(new ServiceUnavailableException());
      }
      return Promise.resolve(world.moduleIds);
    }
  }
  const service = new LearnerAssessmentsService(
    repository,
    new StubEnrollments(),
    new StubCourses(),
  );
  service.clock = () => NOW;
  return { service, world };
}

const state = (assessmentId: string, over: object = {}) => ({
  assessmentId,
  learnerId: LEARNER,
  consecutiveCount: 0,
  lockedUntil: null,
  ...over,
});

describe('list (UC29)', () => {
  test('is for an enrolled Learner only (403)', async () => {
    await rejectsWith(
      build().service.list({ ...learner, role: 'INSTRUCTOR' }, COURSE),
      ForbiddenException,
      'FORBIDDEN',
    );
    const out = build({ enrolled: false });
    await rejectsWith(
      out.service.list(learner, COURSE),
      ForbiddenException,
      'NOT_ENROLLED',
    );
  });

  test('a Course without Assessments gives an empty list', async () => {
    const r = await build().service.list(learner, COURSE);
    assert.deepEqual(r.items, []);
    assert.equal(r.enrollmentId, ENROLLMENT);
    assert.equal(r.readOnly, false);
  });

  test('a Completed Enrollment is read-only (BR-210)', async () => {
    const r = await build({ access: 'ReadOnly' }).service.list(learner, COURSE);
    assert.equal(r.readOnly, true);
  });

  test('a Halted or Withdrawn Enrollment shuts the Learner out: 409 ENROLLMENT_NOT_ACTIVE', async () => {
    await rejectsWith(
      build({ access: 'None' }).service.list(learner, COURSE),
      ConflictException,
      'ENROLLMENT_NOT_ACTIVE',
    );
  });

  test('Module Quizzes follow the Module order, Course-level Quizzes and Assignments come last (BR-193)', async () => {
    const inB = row({ title: 'in B', moduleId: MODULE_B, position: 1 });
    const inA2 = row({ title: 'in A 2', moduleId: MODULE_A, position: 2 });
    const inA1 = row({ title: 'in A 1', moduleId: MODULE_A, position: 1 });
    const course2 = row({ title: 'course quiz', position: 2 });
    const asg1 = assignment({ title: 'assignment', position: 1 });
    // database order is wrong on purpose
    const { service } = build({ rows: [course2, inB, asg1, inA2, inA1] });
    const titles = (await service.list(learner, COURSE)).items.map(
      (i) => i.title,
    );
    assert.deepEqual(titles, [
      'in A 1',
      'in A 2',
      'in B',
      'assignment',
      'course quiz',
    ]);
  });

  test('without Course Service the list still works (ordered by Module id)', async () => {
    const inB = row({ title: 'in B', moduleId: MODULE_B });
    const inA = row({ title: 'in A', moduleId: MODULE_A });
    for (const moduleIds of ['down', null] as const) {
      const { service } = build({ rows: [inB, inA], moduleIds });
      const titles = (await service.list(learner, COURSE)).items.map(
        (i) => i.title,
      );
      assert.deepEqual(titles, ['in A', 'in B']);
    }
  });

  test('an Assignment is NotStarted, then AwaitingResult, then Completed with the score of the latest submission (BR-212)', async () => {
    const a = assignment();
    const none = await build({ rows: [a] }).service.list(learner, COURSE);
    assert.equal(none.items[0].status, 'NotStarted');
    assert.equal(none.items[0].recordedScore, null);
    assert.equal(none.items[0].passed, null); // BR-191: not submitted is not "failed"
    assert.equal(none.items[0].isRequired, true); // BR-206

    const waiting = await build({
      rows: [a],
      submissions: [
        {
          assessmentId: a.id,
          submittedAt: new Date('2026-10-14T01:00:00Z'),
          gradingStatus: 'AwaitingPeerReview',
          finalScore: null,
        },
      ],
    }).service.list(learner, COURSE);
    assert.equal(waiting.items[0].status, 'AwaitingResult');
    assert.equal(waiting.items[0].recordedScore, null);
    assert.equal(waiting.items[0].submittedAt, '2026-10-14T01:00:00.000Z');

    const done = (score: string) =>
      build({
        rows: [a],
        submissions: [
          {
            assessmentId: a.id,
            submittedAt: new Date('2026-10-14T01:00:00Z'),
            gradingStatus: 'Finalized',
            finalScore: { toString: () => score },
          },
        ],
      }).service.list(learner, COURSE);
    const passed = (await done('85.5')).items[0];
    assert.equal(passed.status, 'Completed');
    assert.equal(passed.recordedScore, 85.5);
    assert.equal(passed.passed, true);
    const notPassed = (await done('40')).items[0];
    assert.equal(notPassed.passed, false);
  });

  test('a Quiz is NotStarted, InProgress while an attempt runs, then Completed with the best attempt (BR-198)', async () => {
    const q = row({});
    const attempt = (submittedAt: Date | null, score: string | null) => ({
      assessmentId: q.id,
      submittedAt,
      score: score === null ? null : { toString: () => score },
    });
    const at = (iso: string) => new Date(iso);

    assert.equal(
      (await build({ rows: [q] }).service.list(learner, COURSE)).items[0]
        .status,
      'NotStarted',
    );
    const running = await build({
      rows: [q],
      attempts: [
        attempt(at('2026-10-13T00:00:00Z'), '60'),
        attempt(null, null),
      ],
    }).service.list(learner, COURSE);
    assert.equal(running.items[0].status, 'InProgress');

    const done = (
      await build({
        rows: [q],
        attempts: [
          attempt(at('2026-10-12T00:00:00Z'), '55'),
          attempt(at('2026-10-14T00:00:00Z'), '80'),
          attempt(at('2026-10-13T00:00:00Z'), '60'),
        ],
      }).service.list(learner, COURSE)
    ).items[0];
    assert.equal(done.status, 'Completed');
    assert.equal(done.recordedScore, 80); // the best, not the latest
    assert.equal(done.passed, true);
    assert.equal(done.submittedAt, '2026-10-14T00:00:00.000Z');
    assert.equal(done.timeLimitMinutes, 20);
  });

  test('shows the tries left, and the reopen time while locked; an expired lock counts from zero (BR-199, BR-218, BR-221)', async () => {
    const a = assignment();
    const b = assignment({ position: 2 });
    const c = assignment({ position: 3 });
    const lockedUntil = new Date(NOW.getTime() + 5 * HOUR);
    const { service } = build({
      rows: [a, b, c],
      states: [
        state(a.id, { consecutiveCount: 1 }),
        state(b.id, { consecutiveCount: 3, lockedUntil }),
        state(c.id, {
          consecutiveCount: 3,
          lockedUntil: new Date(NOW.getTime() - HOUR),
        }),
      ],
    });
    const [one, locked, reopened] = (await service.list(learner, COURSE)).items;
    assert.equal(one.attempts.remainingAttempts, 2);
    assert.equal(one.attempts.lockedUntil, null);
    assert.equal(locked.attempts.remainingAttempts, 0);
    assert.equal(locked.attempts.lockedUntil, lockedUntil.toISOString());
    assert.equal(reopened.attempts.remainingAttempts, 3);
    assert.equal(reopened.attempts.lockedUntil, null);
    assert.equal(one.attempts.lockoutHours, 24);
  });
});
