/** Business rules of UC30 (submit Assignment), with Prisma, Learning Service and storage replaced by fakes. */
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { StorageProviderError } from '@learnup/ts-storage';
import type { CurrentUser } from '@learnup/ts-common';
import {
  type AssessmentAccess,
  type AssessmentAccessLevel,
  EnrollmentClient,
} from '../../src/infrastructure/clients/learning/enrollment.client';
import { LearnerSubmissionsService } from '../../src/modules/learner-submissions/learner-submissions.service';
import type { AssignmentFacts } from '../../src/modules/completion-snapshot/completion-snapshot';
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

const OTHER_ORG = '00000000-0000-4000-8000-0000000000bb';

const learner = (userId = LEARNER, organizationId = ORG): CurrentUser => ({
  userId,
  organizationId,
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
  /** The reviews the Learner owes as a peer on the Assignment (D10: the debt is read from these). */
  peerReviews: AssignmentFacts['reviews'];
  submissions: SubmissionRow[];
  cycles: CycleRow[];
  outbox: Record<string, unknown>[];
  failCreateSubmission: boolean;
  /** The order of the locks (by key) and of the reads of a cycle by id, to show the cycle lock comes first (BR-213). */
  log: string[];
  /** Runs when the lock of the cycles of the Assignment is taken: a stand-in for the closing that held it first. */
  onLock: (() => void) | null;
}

function build(over: Partial<World> = {}) {
  const world: World = {
    assignment: assignmentRow(),
    states: new Map(),
    peerReviews: [],
    submissions: [],
    cycles: [],
    outbox: [],
    failCreateSubmission: false,
    log: [],
    onLock: null,
    ...over,
  };
  let seq = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const stateKey = (a: string, l: string) => `${a}:${l}`;

  const repository = {
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    // like the real one: an Assignment of another Organization is not found
    findAssignment: (organizationId: string, id: string) =>
      Promise.resolve(
        world.assignment &&
          world.assignment.organizationId === organizationId &&
          world.assignment.id === id
          ? world.assignment
          : null,
      ),
    // like the real one: only a submission of this Organization, this Assignment and this Learner
    findSubmissionWithReviews: (
      organizationId: string,
      assessmentId: string,
      id: string,
      learnerId: string,
    ) => {
      const found = world.submissions.find(
        (x) =>
          x.id === id &&
          x.assessmentId === assessmentId &&
          x.organizationId === organizationId &&
          x.learnerId === learnerId,
      );
      return Promise.resolve(found ? { ...found, reviews: [] } : null);
    },
    findState: (a: string, l: string) =>
      Promise.resolve(world.states.get(stateKey(a, l)) ?? null),
    findPeerReviews: () => Promise.resolve(world.peerReviews),
    findLatestSubmission: (a: string, l: string) =>
      Promise.resolve(
        world.submissions
          .filter(
            (s) => s.assessmentId === a && s.learnerId === l && !s.supersededAt,
          )
          .sort((x, y) => y.submissionNumber - x.submissionNumber)[0] ?? null,
      ),
    findPlatformSetting: () => Promise.resolve(null),
    lock: (_tx: unknown, key: string) => {
      world.log.push(`lock:${key}`);
      // only the lock of the cycles of the Assignment is the one the closing takes
      if (key.startsWith('cycle:')) world.onLock?.();
      return Promise.resolve();
    },
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
    findCycleById: (id: string) => {
      world.log.push('findCycleById');
      return Promise.resolve(world.cycles.find((c) => c.id === id) ?? null);
    },
    markSuperseded: (_tx: unknown, id: string, at: Date) => {
      const row = world.submissions.find((x) => x.id === id)!;
      row.supersededAt = at;
      return Promise.resolve(row);
    },
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
    /** What Learning Service says the Enrollment allows (assessment-access): Full, ReadOnly (Completed) or None. */
    access: AssessmentAccessLevel = 'Full';
    /** How many times Learning Service was asked. */
    asked = 0;
    getAssessmentAccess(): Promise<AssessmentAccess | null> {
      this.asked += 1;
      return Promise.resolve(
        this.enrolled
          ? {
              enrollmentId: ENROLLMENT,
              status: this.access === 'ReadOnly' ? 'Completed' : 'InProgress',
              access: this.access,
            }
          : null,
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
    assert.equal(r.gradingStatus, 'AwaitingInstructor');
    assert.equal(r.cycle, null);
    assert.equal(
      ctx.world.submissions[0].interventionReason,
      'PEER_REVIEW_DISABLED',
    );
    assert.equal(ctx.world.cycles.length, 0);
  });

  test('with peer review on the submission waits in a cycle that is created on demand (BR-231)', async () => {
    ctx = build({ assignment: assignmentRow(peerOn) });
    const r = await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    assert.equal(r.gradingStatus, 'AwaitingPeerReview');
    assert.equal(ctx.world.cycles.length, 1);
    assert.equal(r.cycle?.opensAt, '2026-10-14T17:00:00.000Z');
    assert.equal(r.cycle?.closesAt, '2026-10-21T17:00:00.000Z');
    assert.equal(r.cycle?.reviewDueAt, '2026-10-24T17:00:00.000Z');
    assert.equal(ctx.world.cycles[0].reviewersPerSubmission, 2);
    assert.equal(ctx.world.submissions[0].cycleId, ctx.world.cycles[0].id);
  });

  test('another Learner in the same cycle joins it, a later day outside it opens the next one (BR-208)', async () => {
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
    const reject = async (
      file: ReturnType<typeof pdf>,
      code: string,
      exception: new (...args: never[]) => Error = BadRequestException,
    ) => {
      await rejectsWith(
        ctx.service.submit(learner(), ASSIGNMENT, {}, file),
        exception,
        code,
      );
      assert.equal(ctx.storage.uploads.length, 0);
    };
    // the raw limit of the default storage plan (10 MiB) is lower than the 50 MiB ceiling
    await reject(
      { ...pdf(), size: 10 * 1024 * 1024 + 1 },
      'FILE_TOO_LARGE',
      PayloadTooLargeException,
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

  test('only an enrolled Learner may submit (403), a Completed Enrollment is read-only (BR-210)', async () => {
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
    ctx.enrollments.access = 'ReadOnly';
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

  test('a Learner who has submitted is told to resubmit instead (UC30.1)', async () => {
    await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    await rejectsWith(
      ctx.service.submit(learner(), ASSIGNMENT, { content: 'y' }),
      ConflictException,
      'SUBMISSION_EXISTS',
    );
    assert.equal(ctx.world.submissions.length, 1);
  });

  test('n consecutive submissions lock the Assignment for m hours, for this Learner only (BR-218, BR-220)', async () => {
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

  test('while locked a submission is refused with the reopen time; after it, counting starts again (BR-218, BR-221)', async () => {
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
    const done = build();
    done.enrollments.access = 'ReadOnly';
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

describe('resubmit (UC30.1)', () => {
  const day1 = new Date('2026-10-14T20:30:00Z'); // 15 Oct 03:30 in Ho Chi Minh: the cycle is 15 - 22 Oct
  const afterCutoff = new Date('2026-10-23T03:00:00Z');

  const submitted = async (
    over: Partial<LearnerAssignmentRow> = peerOn,
    opts: Partial<Parameters<typeof build>[0]> = {},
  ) => {
    const ctx = build({ assignment: assignmentRow(over), ...opts });
    ctx.setNow(day1);
    const first = await ctx.service.submit(learner(), ASSIGNMENT, {
      content: 'first',
    });
    return { ctx, first };
  };

  test('a resubmission in the same open cycle takes the place of the previous one (BR-213)', async () => {
    const { ctx, first } = await submitted();
    ctx.setNow(new Date('2026-10-16T10:00:00Z'));
    const r = await ctx.service.resubmit(learner(), ASSIGNMENT, {
      content: 'second',
    });
    assert.equal(r.submissionNumber, 2);
    assert.equal(r.placement, 'REPLACES_IN_CYCLE');
    assert.equal(r.gradingStatus, 'AwaitingPeerReview');
    assert.equal(r.replacedSubmissionId, first.id);
    assert.equal(r.cycle?.id, first.cycle?.id);
    assert.equal(ctx.world.cycles.length, 1);
    const [old, current] = ctx.world.submissions;
    assert.ok(old.supersededAt, 'the previous submission is superseded');
    assert.equal(current.supersededAt, undefined);
    assert.equal(current.cycleId, old.cycleId);
    assert.equal(current.content, 'second');
    // the latest one is the one that counts (BR-212)
    const view = await ctx.service.getAssignment(learner(), ASSIGNMENT);
    assert.equal(view.latestSubmission?.submissionNumber, 2);
  });

  test('it takes the lock of the cycles of the Assignment before it reads the cycle of the previous submission (BR-213)', async () => {
    const { ctx } = await submitted();
    ctx.world.log.length = 0;
    ctx.setNow(new Date('2026-10-16T10:00:00Z'));
    await ctx.service.resubmit(learner(), ASSIGNMENT, { content: 'second' });
    const lock = ctx.world.log.indexOf(`lock:cycle:${ASSIGNMENT}`);
    const read = ctx.world.log.indexOf('findCycleById');
    assert.ok(lock >= 0, 'the lock of the cycles is taken');
    assert.ok(read >= 0, 'the cycle of the previous submission is read');
    assert.ok(lock < read, `the lock comes first, got ${ctx.world.log.join(',')}`);
  });

  test('a cycle that closes while the resubmission waits for the lock is not joined: the Instructor grades it (BR-213, A1)', async () => {
    const { ctx } = await submitted();
    const cycle = ctx.world.cycles[0];
    // the closing holds the lock first and finishes before this resubmission gets it
    ctx.world.onLock = () => {
      cycle.status = 'Assigned';
    };
    ctx.setNow(new Date('2026-10-16T10:00:00Z')); // before the closing line, as far as the clock goes
    const r = await ctx.service.resubmit(learner(), ASSIGNMENT, {
      content: 'second',
    });
    assert.equal(r.placement, 'INSTRUCTOR');
    assert.equal(r.cycle, null);
    assert.equal(ctx.world.submissions[1].cycleId ?? null, null);
    assert.equal(
      ctx.world.submissions[1].interventionReason,
      'RESUBMITTED_AFTER_CUTOFF',
    );
  });

  test('it counts as one more submission in a row (BR-218) and is announced as Resubmitted', async () => {
    const { ctx, first } = await submitted();
    const r = await ctx.service.resubmit(learner(), ASSIGNMENT, {
      content: 'second',
    });
    assert.equal(r.attempts.remainingAttempts, 1); // n = 3, two submissions so far
    assert.equal(ctx.world.outbox.length, 2);
    const event = ctx.world.outbox[1].payload as Record<string, unknown>;
    assert.equal(event.status, 'Resubmitted');
    assert.equal(event.previousSubmissionId, first.id);
    assert.equal(event.consecutiveCount, 2);
  });

  test('A1: after the closing line of the previous cycle it goes straight to the Instructor (BR-213)', async () => {
    const { ctx } = await submitted();
    ctx.setNow(afterCutoff);
    const r = await ctx.service.resubmit(learner(), ASSIGNMENT, {
      content: 'late',
    });
    assert.equal(r.placement, 'INSTRUCTOR');
    assert.equal(r.cycle, null);
    assert.equal(r.gradingStatus, 'AwaitingInstructor');
    assert.equal(
      ctx.world.submissions[1].interventionReason,
      'RESUBMITTED_AFTER_CUTOFF',
    );
    assert.equal(ctx.world.cycles.length, 1, 'no new cycle is opened for it');
    assert.ok(ctx.world.submissions[0].supersededAt);
  });

  const missedReview = {
    status: 'Missed',
    reviewDueAt: new Date('2026-10-20T00:00:00Z'),
    cycleId: 'c1',
    cycleClosesAt: new Date('2026-10-19T00:00:00Z'),
  };

  test('A2: a Learner who owes a peer review duty joins the cycle that is open now (BR-239)', async () => {
    const { ctx } = await submitted();
    ctx.world.peerReviews = [missedReview];
    ctx.setNow(afterCutoff);
    const r = await ctx.service.resubmit(learner(), ASSIGNMENT, {
      content: 'making up',
    });
    assert.equal(r.placement, 'OPEN_CYCLE');
    assert.equal(r.gradingStatus, 'AwaitingPeerReview');
    assert.equal(ctx.world.cycles.length, 2, 'the cycle of the day is created');
    assert.notEqual(r.cycle?.id, ctx.world.cycles[0].id);
    assert.equal(ctx.world.submissions[1].interventionReason, null);
  });

  test('D-045: a debt repaid in a later cycle follows the Instructor path after the cutoff', async () => {
    const { ctx } = await submitted();
    // The stale marker develop keeps after the debt is repaid (the column is dropped here; the property only reproduces
    // develop's state, so this test fails on develop's source and passes on this change).
    Object.assign(ctx.world.states.get(`${ASSIGNMENT}:${LEARNER}`)!, {
      peerReviewObligation: 'Missed',
    });
    ctx.world.peerReviews = [
      missedReview,
      {
        status: 'Completed',
        reviewDueAt: new Date('2026-10-26T00:00:00Z'),
        cycleId: 'c2',
        cycleClosesAt: new Date('2026-10-23T00:00:00Z'),
      },
    ];
    ctx.setNow(afterCutoff);
    const r = await ctx.service.resubmit(learner(), ASSIGNMENT, {
      content: 'repaid',
    });
    assert.equal(r.placement, 'INSTRUCTOR');
    assert.equal(r.gradingStatus, 'AwaitingInstructor');
    assert.equal(r.cycle, null);
    assert.equal(
      ctx.world.submissions[1].interventionReason,
      'RESUBMITTED_AFTER_CUTOFF',
    );
  });

  test('a duty that was waived (exempted) gives no second chance', async () => {
    const { ctx } = await submitted();
    const state = ctx.world.states.get(`${ASSIGNMENT}:${LEARNER}`)!;
    ctx.world.peerReviews = [missedReview];
    state.exemptedAt = new Date('2026-10-22T00:00:00Z');
    ctx.setNow(afterCutoff);
    const r = await ctx.service.resubmit(learner(), ASSIGNMENT, {
      content: 'late',
    });
    assert.equal(r.placement, 'INSTRUCTOR');
  });

  test('with peer review off the Instructor grades it, as before', async () => {
    const { ctx } = await submitted({});
    const r = await ctx.service.resubmit(learner(), ASSIGNMENT, {
      content: 'again',
    });
    assert.equal(r.placement, 'INSTRUCTOR');
    assert.equal(r.gradingStatus, 'AwaitingInstructor');
    assert.equal(
      ctx.world.submissions[1].interventionReason,
      'PEER_REVIEW_DISABLED',
    );
  });

  test('there must be a previous submission to replace (409)', async () => {
    const ctx = build();
    await rejectsWith(
      ctx.service.resubmit(learner(), ASSIGNMENT, { content: 'x' }),
      ConflictException,
      'NO_PREVIOUS_SUBMISSION',
    );
    assert.equal(ctx.world.submissions.length, 0);
    assert.equal(ctx.world.states.size, 0, 'nothing is counted');
  });

  test('there is no limit on resubmissions: every n in a row pause it, then it opens again (BR-209, BR-218)', async () => {
    const { ctx } = await submitted({ ...peerOn, maxConsecutiveAttempts: 2 });
    // the second one of two in a row locks the Assignment for lockoutHours (24)
    const second = await ctx.service.resubmit(learner(), ASSIGNMENT, {
      content: 'second',
    });
    assert.equal(second.attempts.remainingAttempts, 0);
    assert.equal(
      second.attempts.lockedUntil,
      new Date(day1.getTime() + 24 * HOUR).toISOString(),
    );
    await assert.rejects(
      ctx.service.resubmit(learner(), ASSIGNMENT, { content: 'third' }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(
          (error.getResponse() as { code: string }).code,
          'ASSESSMENT_LOCKED',
        );
        return true;
      },
    );
    // the lock runs out: counting starts again and the Learner can go on
    ctx.setNow(new Date(day1.getTime() + 25 * HOUR));
    const third = await ctx.service.resubmit(learner(), ASSIGNMENT, {
      content: 'third',
    });
    assert.equal(third.submissionNumber, 3);
    assert.equal(third.attempts.remainingAttempts, 1);
    assert.equal(third.attempts.lockedUntil, null);
  });

  test('a Completed Enrollment is read-only (BR-210)', async () => {
    const { ctx } = await submitted();
    ctx.enrollments.access = 'ReadOnly';
    await rejectsWith(
      ctx.service.resubmit(learner(), ASSIGNMENT, { content: 'x' }),
      ConflictException,
      'ENROLLMENT_COMPLETED',
    );
    const view = await ctx.service.getAssignment(learner(), ASSIGNMENT);
    assert.equal(view.resubmission, null);
  });

  test('an empty resubmission and a wrong file are refused, only an enrolled Learner may resubmit', async () => {
    const { ctx } = await submitted();
    await rejectsWith(
      ctx.service.resubmit(learner(), ASSIGNMENT, { content: ' ' }),
      BadRequestException,
      'SUBMISSION_EMPTY',
    );
    await rejectsWith(
      ctx.service.resubmit(
        learner(),
        ASSIGNMENT,
        {},
        { buffer: Buffer.from('MZ'), originalname: 'virus.exe', size: 2 },
      ),
      BadRequestException,
      'SUBMISSION_FILE_INVALID',
    );
    await rejectsWith(
      ctx.service.resubmit({ ...learner(), role: 'INSTRUCTOR' }, ASSIGNMENT, {
        content: 'x',
      }),
      ForbiddenException,
      'FORBIDDEN',
    );
    ctx.enrollments.enrolled = false;
    await rejectsWith(
      ctx.service.resubmit(learner(), ASSIGNMENT, { content: 'x' }),
      ForbiddenException,
      'NOT_ENROLLED',
    );
    assert.equal(ctx.world.submissions.length, 1);
  });

  test('a new file is stored and the previous file stays as history', async () => {
    const { ctx } = await submitted(peerOn);
    await ctx.service.resubmit(learner(), ASSIGNMENT, {}, pdf());
    assert.equal(ctx.storage.uploads.length, 1);
    assert.equal(ctx.storage.deleted.length, 0);
    assert.equal(ctx.world.submissions[1].fileName, 'work.pdf');
  });

  test('when saving fails the old submission is untouched and the new file is removed', async () => {
    const { ctx } = await submitted();
    ctx.world.failCreateSubmission = true;
    await assert.rejects(
      ctx.service.resubmit(learner(), ASSIGNMENT, {}, pdf()),
      /db down/,
    );
    assert.equal(ctx.world.submissions.length, 1);
    assert.equal(ctx.world.submissions[0].supersededAt, undefined);
    assert.equal(ctx.storage.files.size, 0);
  });

  test('the Learner view says where a resubmission would go (UC30.1 outlook)', async () => {
    const ctx = build({ assignment: assignmentRow(peerOn) });
    ctx.setNow(day1);
    assert.equal(
      (await ctx.service.getAssignment(learner(), ASSIGNMENT)).resubmission,
      null,
      'nothing to replace yet',
    );
    const first = await ctx.service.submit(learner(), ASSIGNMENT, {
      content: 'first',
    });
    const open = (await ctx.service.getAssignment(learner(), ASSIGNMENT))
      .resubmission;
    assert.equal(open?.placement, 'REPLACES_IN_CYCLE');
    assert.equal(open?.cycleClosesAt, first.cycle?.closesAt);

    ctx.setNow(afterCutoff);
    const closed = (await ctx.service.getAssignment(learner(), ASSIGNMENT))
      .resubmission;
    assert.equal(closed?.placement, 'INSTRUCTOR');
    assert.equal(closed?.cycleClosesAt, null);
  });
});

/** The grader finished: the submission is Finalized with this score. */
const finalize = (
  row: SubmissionRow,
  score = '80',
  comment: string | null = 'Well done',
) =>
  Object.assign(row, {
    gradingStatus: 'Finalized',
    finalScore: { toString: () => score },
    finalizedAt: new Date('2026-10-20T08:00:00Z'),
    finalizationComment: comment,
  });

describe('getLatestResult (UC30.2)', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  test('a Finalized submission gives its result, under Full and under ReadOnly (Completed), asking Learning Service once', async () => {
    const receipt = await ctx.service.submit(learner(), ASSIGNMENT, {
      content: 'x',
    });
    finalize(ctx.world.submissions[0]);
    for (const access of ['Full', 'ReadOnly'] as const) {
      ctx.enrollments.access = access;
      ctx.enrollments.asked = 0;
      const result = await ctx.service.getLatestResult(learner(), ASSIGNMENT);
      assert.equal(result.submission.id, receipt.id, access);
      assert.equal(result.assignment.id, ASSIGNMENT, access);
      assert.equal(result.finalScore, 80, access);
      assert.equal(result.passed, true, access);
      assert.equal(result.finalizationComment, 'Well done', access);
      assert.equal(ctx.enrollments.asked, 1, `${access}: one question`);
    }
  });

  test('below the passing score the result says not passed', async () => {
    await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    finalize(ctx.world.submissions[0], '55');
    const result = await ctx.service.getLatestResult(learner(), ASSIGNMENT);
    assert.equal(result.finalScore, 55);
    assert.equal(result.passed, false);
  });

  test('a submission that is not Finalized yet is 409 SUBMISSION_NOT_FINALIZED, after one question', async () => {
    await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    ctx.enrollments.asked = 0;
    await rejectsWith(
      ctx.service.getLatestResult(learner(), ASSIGNMENT),
      ConflictException,
      'SUBMISSION_NOT_FINALIZED',
    );
    assert.equal(ctx.enrollments.asked, 1);
  });

  test("another Learner's submission is never returned: 404 SUBMISSION_NOT_FOUND, by the latest and by id", async () => {
    await ctx.service.submit(learner(OTHER_LEARNER), ASSIGNMENT, {
      content: 'theirs',
    });
    const theirs = finalize(ctx.world.submissions[0]);
    await rejectsWith(
      ctx.service.getLatestResult(learner(), ASSIGNMENT),
      NotFoundException,
      'SUBMISSION_NOT_FOUND',
    );
    await rejectsWith(
      ctx.service.getResult(learner(), ASSIGNMENT, theirs.id),
      NotFoundException,
      'SUBMISSION_NOT_FOUND',
    );
  });

  test("a Learner of another Organization cannot reach the Assignment or its results: 404 ASSIGNMENT_NOT_FOUND", async () => {
    await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    const mine = finalize(ctx.world.submissions[0]);
    const stranger = learner(LEARNER, OTHER_ORG);
    await rejectsWith(
      ctx.service.getLatestResult(stranger, ASSIGNMENT),
      NotFoundException,
      'ASSIGNMENT_NOT_FOUND',
    );
    await rejectsWith(
      ctx.service.getResult(stranger, ASSIGNMENT, mine.id),
      NotFoundException,
      'ASSIGNMENT_NOT_FOUND',
    );
  });
});

describe('what the Enrollment allows (BR-210, L17)', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  test('Halted or Withdrawn (None) shuts the Learner out of every screen: 409 ENROLLMENT_NOT_ACTIVE', async () => {
    await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    ctx.enrollments.access = 'None';
    const calls = [
      () => ctx.service.getAssignment(learner(), ASSIGNMENT),
      () => ctx.service.submit(learner(), ASSIGNMENT, { content: 'y' }),
      () => ctx.service.resubmit(learner(), ASSIGNMENT, { content: 'y' }),
      () => ctx.service.getResult(learner(), ASSIGNMENT, ASSIGNMENT),
      () => ctx.service.getLatestResult(learner(), ASSIGNMENT),
      () => ctx.service.downloadPromptFile(learner(), ASSIGNMENT),
    ];
    for (const call of calls) {
      await rejectsWith(call(), ConflictException, 'ENROLLMENT_NOT_ACTIVE');
    }
    assert.equal(ctx.world.submissions.length, 1, 'nothing new was saved');
  });

  test('Completed (ReadOnly) still lets the Learner read the Assignment and the prompt file, but not write', async () => {
    await ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' });
    ctx.enrollments.access = 'ReadOnly';
    const view = await ctx.service.getAssignment(learner(), ASSIGNMENT);
    assert.equal(view.readOnly, true);
    assert.equal(view.resubmission, null);
    await rejectsWith(
      ctx.service.resubmit(learner(), ASSIGNMENT, { content: 'y' }),
      ConflictException,
      'ENROLLMENT_COMPLETED',
    );
    assert.equal(ctx.world.submissions.length, 1);
  });

  test('the latest result asks Learning Service once, and a Learner who has not submitted gets 404 SUBMISSION_NOT_FOUND', async () => {
    await rejectsWith(
      ctx.service.getLatestResult(learner(), ASSIGNMENT),
      NotFoundException,
      'SUBMISSION_NOT_FOUND',
    );
    assert.equal(ctx.enrollments.asked, 1);
  });

  test('when Learning Service cannot answer, nothing is saved and the Learner gets the 503', async () => {
    ctx.enrollments.getAssessmentAccess = () =>
      Promise.reject(new ServiceUnavailableException());
    await assert.rejects(
      ctx.service.submit(learner(), ASSIGNMENT, { content: 'x' }),
      ServiceUnavailableException,
    );
    assert.equal(ctx.world.submissions.length, 0);
  });
});
