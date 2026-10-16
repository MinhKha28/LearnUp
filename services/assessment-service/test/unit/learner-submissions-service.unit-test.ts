/** Business rules of UC30 (submit Assignment), with Prisma, Learning Service and storage replaced by fakes. */
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageProviderError } from '@learnup/ts-storage';
import type { CurrentUser } from '@learnup/ts-common';
import {
  EnrolledCourse,
  EnrollmentClient,
} from '../../src/infrastructure/clients/learning/enrollment.client';
import { LearnerSubmissionsService } from '../../src/modules/learner-submissions/learner-submissions.service';
import type {
  CycleRow,
  LearnerAssignmentRow,
  LearnerStateRow,
  LearnerSubmissionsRepository,
  SubmissionRow,
} from '../../src/modules/learner-submissions/learner-submissions.repository';
import { COURSE, MemoryStorage, ORG, rejectsWith } from './fixtures';

const ASSIGNMENT = '00000000-0000-4000-8000-0000000000a1';
const LEARNER = '00000000-0000-4000-8000-0000000000c1';
const OTHER_LEARNER = '00000000-0000-4000-8000-0000000000c2';
const ENROLLMENT = '00000000-0000-4000-8000-0000000000e1';
const HOUR = 3_600_000;

const learner = (userId = LEARNER): CurrentUser => ({
  userId,
  organizationId: ORG,
  role: 'LEARNER',
  isAuthenticated: true,
});

const pdf = (extra = 'work') => ({
  buffer: Buffer.concat([Buffer.from('%PDF-1.7 '), Buffer.from(extra)]),
  originalname: 'work.pdf',
  size: 100,
});

const assignmentRow = (over: Partial<LearnerAssignmentRow> = {}) =>
  ({
    id: ASSIGNMENT,
    organizationId: ORG,
    courseId: COURSE,
    kind: 'ASSIGNMENT',
    title: 'Safety',
    prompt: 'Write it',
    promptFileKey: null,
    promptFileName: null,
    promptFileMime: null,
    promptFileSizeBytes: null,
    passingScore: { toString: () => '70' },
    expectedDurationMinutes: 90,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    peerReviewEnabled: false,
    peerReviewersPerSubmission: null,
    peerReviewCycleDays: null,
    peerReviewDeadlineDays: null,
    peerReviewScoreGap: null,
    disabledAt: null,
    rubricCriteria: [
      { id: 'r1', name: 'A', description: 'a', maxPoints: 40, position: 1 },
    ],
    ...over,
  }) as unknown as LearnerAssignmentRow;

const peerOn = {
  peerReviewEnabled: true,
  peerReviewersPerSubmission: 2,
  peerReviewCycleDays: 7,
  peerReviewDeadlineDays: 3,
  peerReviewScoreGap: { toString: () => '20' },
} as unknown as Partial<LearnerAssignmentRow>;

interface World {
  assignment: LearnerAssignmentRow | null;
  states: Map<string, LearnerStateRow>;
  submissions: SubmissionRow[];
  cycles: CycleRow[];
  outbox: Record<string, unknown>[];
  completed: Set<string>;
  failCreateSubmission: boolean;
}

function build(over: Partial<World> = {}) {
  const world: World = {
    assignment: assignmentRow(),
    states: new Map(),
    submissions: [],
    cycles: [],
    outbox: [],
    completed: new Set(),
    failCreateSubmission: false,
    ...over,
  };
  let seq = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const stateKey = (a: string, l: string) => `${a}:${l}`;

  const repository = {
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    findAssignment: () => Promise.resolve(world.assignment),
    findState: (a: string, l: string) =>
      Promise.resolve(world.states.get(stateKey(a, l)) ?? null),
    findLatestSubmission: (a: string, l: string) =>
      Promise.resolve(
        world.submissions
          .filter(
            (s) => s.assessmentId === a && s.learnerId === l && !s.supersededAt,
          )
          .sort((x, y) => y.submissionNumber - x.submissionNumber)[0] ?? null,
      ),
    isEnrollmentCompleted: (e: string) =>
      Promise.resolve(world.completed.has(e)),
    findPlatformSetting: () => Promise.resolve(null),
    lock: () => Promise.resolve(),
    ensureState: (
      _tx: unknown,
      org: string,
      a: string,
      l: string,
      now: Date,
    ) => {
      const key = stateKey(a, l);
      if (!world.states.has(key)) {
        world.states.set(key, {
          id: id(),
          organizationId: org,
          assessmentId: a,
          learnerId: l,
          firstActivityAt: now,
          consecutiveCount: 0,
          lockedUntil: null,
          latestSubmissionId: null,
        } as unknown as LearnerStateRow);
      }
      return Promise.resolve(world.states.get(key)!);
    },
    updateState: (
      _tx: unknown,
      stateId: string,
      data: Partial<LearnerStateRow>,
    ) => {
      const found = [...world.states.values()].find((s) => s.id === stateId)!;
      Object.assign(found, data);
      return Promise.resolve(found);
    },
    findCycleContaining: (_tx: unknown, _a: string, at: Date) =>
      Promise.resolve(
        world.cycles.find((c) => c.opensAt <= at && c.closesAt > at) ?? null,
      ),
    findLatestCycle: () =>
      Promise.resolve(
        [...world.cycles].sort(
          (x, y) => y.closesAt.getTime() - x.closesAt.getTime(),
        )[0] ?? null,
      ),
    createCycle: (_tx: unknown, data: Record<string, unknown>) => {
      const cycle = { id: id(), ...data } as unknown as CycleRow;
      world.cycles.push(cycle);
      return Promise.resolve(cycle);
    },
    nextSubmissionNumber: (_tx: unknown, a: string, l: string) =>
      Promise.resolve(
        Math.max(
          0,
          ...world.submissions
            .filter((s) => s.assessmentId === a && s.learnerId === l)
            .map((s) => s.submissionNumber),
        ) + 1,
      ),
    createSubmission: (_tx: unknown, data: Record<string, unknown>) => {
      if (world.failCreateSubmission) {
        return Promise.reject(new Error('db down'));
      }
      const row = { id: id(), ...data } as unknown as SubmissionRow;
      world.submissions.push(row);
      return Promise.resolve(row);
    },
    createOutboxEvent: (_tx: unknown, data: Record<string, unknown>) => {
      world.outbox.push(data);
      return Promise.resolve(data);
    },
  } as unknown as LearnerSubmissionsRepository;

  class StubEnrollments extends EnrollmentClient {
    enrolled = true;
    findEnrollment(courseId: string): Promise<EnrolledCourse | null> {
      return Promise.resolve(
        this.enrolled ? { courseId, enrollmentId: ENROLLMENT } : null,
      );
    }
  }
  const enrollments = new StubEnrollments();
  const storage = new MemoryStorage();
  const service = new LearnerSubmissionsService(
    repository,
    enrollments,
    storage,
  );
  let now = new Date('2026-10-14T20:30:00Z'); // 15 Oct 03:30 in Ho Chi Minh
  service.clock = () => now;
  return {
    service,
    world,
    storage,
    enrollments,
    setNow: (d: Date) => (now = d),
  };
}

describe('submit (UC30)', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  test('stores the work, counts it and tells the Learner how many attempts are left', async () => {
    const r = await ctx.service.submit(
      learner(),
      ASSIGNMENT,
      { content: '  my answer  ' },
      pdf(),
    );
    assert.equal(r.submissionNumber, 1);
    assert.equal(r.attempts.remainingAttempts, 2);
    assert.equal(r.attempts.lockedUntil, null);
    const saved = ctx.world.submissions[0];
    assert.equal(saved.content, 'my answer');
    assert.equal(saved.fileName, 'work.pdf');
    assert.equal(saved.fileMime, 'application/pdf');
    assert.equal(ctx.storage.uploads.length, 1);
    assert.match(
      ctx.storage.uploads[0].folder,
      /assignments\/.+\/submissions$/,
    );
    // UC30 step 8
    assert.equal(ctx.world.outbox.length, 1);
    assert.equal(
      ctx.world.outbox[0].eventType,
      'LearnerAssessmentStatusChanged',
    );
  });

  test('with peer review off the Instructor grades it directly', async () => {
    const r = await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    assert.equal(r.gradingStatus, 'NeedsInstructorGrading');
    assert.equal(r.cycle, null);
    assert.equal(
      ctx.world.submissions[0].interventionReason,
      'PEER_REVIEW_DISABLED',
    );
    assert.equal(ctx.world.cycles.length, 0);
  });

  test('with peer review on the submission waits in a cycle that is created on demand (BR-312)', async () => {
    ctx = build({ assignment: assignmentRow(peerOn) });
    const r = await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    assert.equal(r.gradingStatus, 'WaitingForCycle');
    assert.equal(ctx.world.cycles.length, 1);
    assert.equal(r.cycle?.opensAt, '2026-10-14T17:00:00.000Z');
    assert.equal(r.cycle?.closesAt, '2026-10-21T17:00:00.000Z');
    assert.equal(r.cycle?.reviewDueAt, '2026-10-24T17:00:00.000Z');
    assert.equal(ctx.world.cycles[0].reviewersPerSubmission, 2);
    assert.equal(ctx.world.submissions[0].cycleId, ctx.world.cycles[0].id);
  });

  test('another Learner in the same cycle joins it, a later day outside it opens the next one (BR-167)', async () => {
    ctx = build({ assignment: assignmentRow(peerOn) });
    await ctx.service.submit(learner(), ASSIGNMENT, { content: 'a' });
    ctx.setNow(new Date('2026-10-15T10:00:00Z'));
    await ctx.service.submit(learner(OTHER_LEARNER), ASSIGNMENT, {
      content: 'b',
    });
    assert.equal(ctx.world.cycles.length, 1);
    assert.equal(ctx.world.submissions[1].cycleId, ctx.world.cycles[0].id);

    ctx.setNow(new Date('2026-10-23T03:00:00Z')); // after the closing line
    const third = '00000000-0000-4000-8000-0000000000c3';
    const r = await ctx.service.submit(learner(third), ASSIGNMENT, {
      content: 'c',
    });
    assert.equal(ctx.world.cycles.length, 2);
    assert.equal(r.cycle?.opensAt, ctx.world.cycles[0].closesAt.toISOString());
  });

  test('an empty submission is refused (MSG02)', async () => {
    await rejectsWith(
      ctx.service.submit(learner(), ASSIGNMENT, { content: '   ' }),
      BadRequestException,
      'SUBMISSION_EMPTY',
    );
    assert.equal(ctx.world.submissions.length, 0);
  });

  test('a file must be a PDF, DOCX or ZIP of at most 50 MB, judged by its bytes (MSG20)', async () => {
    const reject = async (file: ReturnType<typeof pdf>, code: string) => {
      await rejectsWith(
        ctx.service.submit(learner(), ASSIGNMENT, {}, file),
        BadRequestException,
        code,
      );
      assert.equal(ctx.storage.uploads.length, 0);
    };
    await reject(
      { ...pdf(), size: 50 * 1024 * 1024 + 1 },
      'SUBMISSION_FILE_TOO_LARGE',
    );
    await reject(
      { ...pdf(), originalname: 'virus.exe' },
      'SUBMISSION_FILE_INVALID',
    );
    await reject(
      { buffer: Buffer.from('just text'), originalname: 'fake.pdf', size: 9 },
      'SUBMISSION_FILE_INVALID',
    );

    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]);
    for (const name of ['a.zip', 'b.docx', 'C.DOCX']) {
      const b = build();
      await b.service.submit(
        learner(),
        ASSIGNMENT,
        {},
        { buffer: zip, originalname: name, size: 6 },
      );
      assert.equal(b.world.submissions.length, 1, name);
    }
  });

  test('only an enrolled Learner may submit (403), a Completed Enrollment is read-only (BR-169)', async () => {
    await rejectsWith(
      ctx.service.submit({ ...learner(), role: 'INSTRUCTOR' }, ASSIGNMENT, {
        content: 'x',
      }),
      ForbiddenException,
      'FORBIDDEN',
    );
    ctx.enrollments.enrolled = false;
    await rejectsWith(
      ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' }),
      ForbiddenException,
      'NOT_ENROLLED',
    );
    ctx.enrollments.enrolled = true;
    ctx.world.completed.add(ENROLLMENT);
    await rejectsWith(
      ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' }),
      ConflictException,
      'ENROLLMENT_COMPLETED',
    );
    assert.equal(ctx.world.submissions.length, 0);
  });

  test('an unknown or Disabled Assignment is a 404', async () => {
    ctx.world.assignment = null;
    await rejectsWith(
      ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' }),
      NotFoundException,
    );
    ctx.world.assignment = assignmentRow({ disabledAt: new Date() });
    await rejectsWith(
      ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' }),
      NotFoundException,
    );
  });

  test('a Learner who has submitted cannot submit again yet (resubmitting is UC30.1)', async () => {
    await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    await rejectsWith(
      ctx.service.submit(learner(), ASSIGNMENT, { content: 'y' }),
      ConflictException,
      'SUBMISSION_EXISTS',
    );
    assert.equal(ctx.world.submissions.length, 1);
  });

  test('n consecutive submissions lock the Assignment for m hours, for this Learner only (BR-176, BR-178)', async () => {
    // two earlier submissions, replaced since: the next one is the third = n
    ctx.world.states.set(`${ASSIGNMENT}:${LEARNER}`, {
      id: 's1',
      organizationId: ORG,
      assessmentId: ASSIGNMENT,
      learnerId: LEARNER,
      consecutiveCount: 2,
      lockedUntil: null,
    } as unknown as LearnerStateRow);
    const r = await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    const now = new Date('2026-10-14T20:30:00Z');
    assert.equal(r.attempts.remainingAttempts, 0);
    assert.equal(
      r.attempts.lockedUntil,
      new Date(now.getTime() + 24 * HOUR).toISOString(),
    );

    // another Learner is not affected
    const other = await ctx.service.submit(learner(OTHER_LEARNER), ASSIGNMENT, {
      content: 'x',
    });
    assert.equal(other.attempts.remainingAttempts, 2);
  });

  test('while locked a submission is refused with the reopen time; after it, counting starts again (BR-176, BR-179)', async () => {
    const lockedUntil = new Date('2026-10-15T06:00:00Z');
    ctx.world.states.set(`${ASSIGNMENT}:${LEARNER}`, {
      id: 's1',
      organizationId: ORG,
      assessmentId: ASSIGNMENT,
      learnerId: LEARNER,
      consecutiveCount: 3,
      lockedUntil,
    } as unknown as LearnerStateRow);
    ctx.world.submissions.push({
      id: 'old',
      assessmentId: ASSIGNMENT,
      learnerId: LEARNER,
      submissionNumber: 3,
      supersededAt: new Date(),
    } as unknown as SubmissionRow);

    await assert.rejects(
      ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        const body = error.getResponse() as {
          code: string;
          lockedUntil: string;
        };
        assert.equal(body.code, 'ASSESSMENT_LOCKED');
        assert.equal(body.lockedUntil, lockedUntil.toISOString());
        return true;
      },
    );
    const view = await ctx.service.getAssignment(learner(), ASSIGNMENT);
    assert.equal(view.attempts.remainingAttempts, 0);
    assert.equal(view.attempts.lockedUntil, lockedUntil.toISOString());

    ctx.setNow(new Date('2026-10-15T06:00:01Z')); // the lock has run out
    const r = await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    assert.equal(r.attempts.remainingAttempts, 2); // counting started again from 1
    assert.equal(r.submissionNumber, 4);
  });

  test('a failed upload is a 503 and nothing is saved', async () => {
    ctx.storage.upload = () => Promise.reject(new StorageProviderError('down'));
    await rejectsWith(
      ctx.service.submit(learner(), ASSIGNMENT, {}, pdf()),
      ServiceUnavailableException,
      'STORAGE_UNAVAILABLE',
    );
    assert.equal(ctx.world.submissions.length, 0);
  });

  test('when saving fails after the upload, the stored file is removed again', async () => {
    ctx.world.failCreateSubmission = true;
    await assert.rejects(
      ctx.service.submit(learner(), ASSIGNMENT, {}, pdf()),
      /db down/,
    );
    assert.equal(ctx.storage.deleted.length, 1);
    assert.equal(ctx.storage.files.size, 0); // nothing is left in the storage
  });
});

describe('getAssignment (UC30 step 1)', () => {
  test('shows the prompt, the Rubric and the attempts of an enrolled Learner', async () => {
    const { service } = build({
      assignment: assignmentRow({
        promptFileKey: 'k',
        promptFileName: 'brief.pdf',
        promptFileSizeBytes: BigInt(10),
      }),
    });
    const view = await service.getAssignment(learner(), ASSIGNMENT);
    assert.equal(view.title, 'Safety');
    assert.equal(view.passingScore, 70);
    assert.deepEqual(view.promptFile, { fileName: 'brief.pdf', sizeBytes: 10 });
    assert.equal(view.rubric.length, 1);
    assert.equal(view.attempts.remainingAttempts, 3);
    assert.equal(view.readOnly, false);
    assert.equal(view.latestSubmission, null);
  });

  test('a Completed Enrollment is read-only; someone not enrolled gets 403', async () => {
    const done = build({ completed: new Set([ENROLLMENT]) });
    assert.equal(
      (await done.service.getAssignment(learner(), ASSIGNMENT)).readOnly,
      true,
    );
    const out = build();
    out.enrollments.enrolled = false;
    await rejectsWith(
      out.service.getAssignment(learner(), ASSIGNMENT),
      ForbiddenException,
      'NOT_ENROLLED',
    );
  });
});
