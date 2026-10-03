/** Business rules of UC19 / UC19.1 / UC19.2 / UC19.3 / UC19.4, with Prisma and Course Service replaced by fakes. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CreateAssignmentDto } from '../../src/modules/assessments/dto/create-assignment.dto';
import {
  ASSIGNMENT,
  assignmentRow,
  asRole,
  build,
  COURSE,
  instructor,
  OTHER_INSTRUCTOR,
  rejectsWith,
} from './fixtures';

const validCreate: CreateAssignmentDto = {
  courseId: COURSE,
  title: '  Safety Assignment  ',
  prompt: '  Describe the procedure.  ',
  passingScore: 70,
  expectedDurationMinutes: 90,
  rubric: [
    { name: ' A ', description: ' A desc ', maxPoints: 40 },
    { name: 'B', description: 'B desc', maxPoints: 60 },
  ],
};

describe('createAssignment (UC19.2)', () => {
  test('only an Instructor with an organization may create (403)', async () => {
    for (const role of ['LEARNER', 'ORGANIZER', 'ADMIN'] as const) {
      const { assessments } = build();
      await rejectsWith(
        assessments.createAssignment(asRole(role), validCreate),
        ForbiddenException,
        'FORBIDDEN',
      );
    }
    const { assessments } = build();
    await rejectsWith(
      assessments.createAssignment(
        { ...instructor, organizationId: undefined },
        validCreate,
      ),
      ForbiddenException,
    );
  });

  test('needs a prompt text or a prompt file', async () => {
    const { assessments } = build();
    await rejectsWith(
      assessments.createAssignment(instructor, {
        ...validCreate,
        prompt: '   ',
      }),
      BadRequestException,
      'ASSIGNMENT_PROMPT_REQUIRED',
    );
    // a file alone is enough
    const { assessments: withFile } = build();
    const created = await withFile.createAssignment(instructor, {
      ...validCreate,
      prompt: undefined,
      promptFile: {
        fileKey: 'k',
        fileName: 'brief.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
      },
    });
    assert.equal(created.promptFile?.fileName, 'brief.pdf');
  });

  test('a Course the caller does not own is reported as not found (BR-79, BR-287)', async () => {
    const { assessments } = build({
      course: { instructorId: OTHER_INSTRUCTOR },
    });
    await rejectsWith(
      assessments.createAssignment(instructor, validCreate),
      NotFoundException,
    );
    const { assessments: otherOrg } = build({
      course: { organizationId: '00000000-0000-4000-8000-0000000000bb' },
    });
    await rejectsWith(
      otherOrg.createAssignment(instructor, validCreate),
      NotFoundException,
    );
  });

  test('refuses a Locked Course (BR-318)', async () => {
    const { assessments, calls } = build({ course: { locked: true } });
    await rejectsWith(
      assessments.createAssignment(instructor, validCreate),
      ConflictException,
      'COURSE_LOCKED',
    );
    assert.equal(calls.created, null);
  });

  test('only Draft, Rejected and Published Courses accept a new Assignment (BR-284)', async () => {
    for (const status of ['Draft', 'Rejected', 'Published', 'DRAFT']) {
      const { assessments } = build({ course: { status } });
      await assessments.createAssignment(instructor, validCreate);
    }
    for (const status of ['Submitted', 'Archived']) {
      const { assessments } = build({ course: { status } });
      await rejectsWith(
        assessments.createAssignment(instructor, validCreate),
        ConflictException,
        'COURSE_NOT_EDITABLE',
      );
    }
    const { assessments } = build({ course: { disabled: true } });
    await rejectsWith(
      assessments.createAssignment(instructor, validCreate),
      ConflictException,
      'COURSE_NOT_EDITABLE',
    );
  });

  test('stores the Assignment as required, without Peer Review, at the end of the tree', async () => {
    const { assessments, calls } = build({ maxPosition: 4 });
    const created = await assessments.createAssignment(instructor, validCreate);

    assert.equal(calls.created?.isRequired, true); // BR-165
    assert.equal(calls.created?.peerReviewEnabled, false); // set later by UC19.5
    assert.equal(calls.created?.kind, 'ASSIGNMENT');
    assert.equal(calls.created?.position, 5); // BR-154
    assert.equal(calls.created?.title, 'Safety Assignment'); // trimmed
    assert.equal(calls.created?.prompt, 'Describe the procedure.');
    assert.equal(created.peerReview.enabled, false);
    assert.equal(created.locked, false);
  });

  test('keeps the Rubric in the order submitted, trimmed', async () => {
    const { assessments, calls } = build();
    const created = await assessments.createAssignment(instructor, validCreate);

    assert.deepEqual(
      calls.rubricRows.map((r) => [
        r.name,
        r.description,
        r.maxPoints,
        r.position,
      ]),
      [
        ['A', 'A desc', 40, 1],
        ['B', 'B desc', 60, 2],
      ],
    );
    assert.deepEqual(
      created.rubric.map((r) => r.position),
      [1, 2],
    );
  });

  test('falls back to the platform defaults for n and m (BR-175)', async () => {
    const { assessments, calls } = build();
    await assessments.createAssignment(instructor, validCreate);
    assert.equal(calls.created?.maxConsecutiveAttempts, 3);
    assert.equal(calls.created?.lockoutHours, 24);

    const configured = build({
      settings: { defaultMaxConsecutiveAttempts: 5, defaultLockoutHours: 12 },
    });
    await configured.assessments.createAssignment(instructor, validCreate);
    assert.equal(configured.calls.created?.maxConsecutiveAttempts, 5);
    assert.equal(configured.calls.created?.lockoutHours, 12);

    const explicit = build({
      settings: { defaultMaxConsecutiveAttempts: 5, defaultLockoutHours: 12 },
    });
    await explicit.assessments.createAssignment(instructor, {
      ...validCreate,
      maxConsecutiveAttempts: 2,
      lockoutHours: 48,
    });
    assert.equal(explicit.calls.created?.maxConsecutiveAttempts, 2);
    assert.equal(explicit.calls.created?.lockoutHours, 48);
  });

  test('records AssignmentCreated so the Course can add the duration (BR-51, BR-172)', async () => {
    const { assessments, calls } = build();
    await assessments.createAssignment(instructor, validCreate);
    assert.equal(calls.outbox.length, 1);
    assert.equal(calls.outbox[0].eventType, 'AssignmentCreated');
    assert.equal(calls.outbox[0].payload.expectedDurationMinutes, 90);
    assert.equal(calls.outbox[0].payload.courseId, COURSE);
  });
});

describe('listAssignments / getAssignment (UC19, UC19.1)', () => {
  test('the list is a single page plus the Course-level flags', async () => {
    const rows = [
      assignmentRow({ id: 'a1', position: 1 }),
      assignmentRow({ id: 'a2', position: 2, _count: { submissions: 3 } }),
    ];
    const { assessments } = build({ rows, course: { locked: true } });
    const page = await assessments.listAssignments(instructor, COURSE);

    assert.deepEqual(page.meta, {
      current: 1,
      pageSize: 2,
      pages: 1,
      total: 2,
    });
    assert.equal(page.courseLocked, true);
    assert.equal(page.courseStatus, 'Draft');
    assert.deepEqual(
      page.items.map((i) => [i.id, i.locked]),
      [
        ['a1', false],
        ['a2', true], // BR-98: has a submission
      ],
    );
  });

  test('an empty Course gives an empty page, not an error', async () => {
    const { assessments } = build({ rows: [] });
    const page = await assessments.listAssignments(instructor, COURSE);
    assert.deepEqual(page.items, []);
    assert.deepEqual(page.meta, {
      current: 1,
      pageSize: 1,
      pages: 0,
      total: 0,
    });
  });

  test('detail carries prompt, Rubric, grading settings and the lock flags', async () => {
    const { assessments } = build({
      row: assignmentRow({
        peerReviewEnabled: true,
        peerReviewersPerSubmission: 2,
        peerReviewCycleDays: 7,
        peerReviewDeadlineDays: 3,
        peerReviewScoreGap: 20,
        _count: { submissions: 1 },
      }),
      course: { locked: true },
    });
    const detail = await assessments.getAssignment(instructor, ASSIGNMENT);

    assert.equal(detail.passingScore, 70);
    assert.equal(detail.expectedDurationMinutes, 60);
    assert.deepEqual(detail.peerReview, {
      enabled: true,
      reviewersPerSubmission: 2,
      cycleDays: 7,
      deadlineDays: 3,
      scoreGap: 20,
    });
    assert.equal(detail.rubric.length, 2);
    assert.equal(detail.locked, true);
    assert.equal(detail.courseLocked, true);
  });

  test('unknown Assignment, other Instructor and non-Instructors are refused', async () => {
    await rejectsWith(
      build({ row: null }).assessments.getAssignment(instructor, ASSIGNMENT),
      NotFoundException,
    );
    await rejectsWith(
      build({
        course: { instructorId: OTHER_INSTRUCTOR },
      }).assessments.getAssignment(instructor, ASSIGNMENT),
      NotFoundException,
    );
    await rejectsWith(
      build().assessments.listAssignments(asRole('LEARNER'), COURSE),
      ForbiddenException,
    );
  });
});

describe('updateAssignment (UC19.3)', () => {
  test('before any submission everything can change; the Rubric is replaced', async () => {
    const { assessments, calls } = build();
    await assessments.updateAssignment(instructor, ASSIGNMENT, {
      title: 'New title',
      prompt: 'New prompt',
      passingScore: 80,
      maxConsecutiveAttempts: 5,
      lockoutHours: 12,
      expectedDurationMinutes: 90,
      rubric: [{ name: 'Z', description: 'Z desc', maxPoints: 100 }],
    });

    assert.deepEqual(calls.updates[0], {
      title: 'New title',
      prompt: 'New prompt',
      passingScore: 80,
      maxConsecutiveAttempts: 5,
      lockoutHours: 12,
      expectedDurationMinutes: 90,
    });
    assert.equal(calls.rubricDeletes, 1);
    assert.equal(calls.rubricRows.length, 1);
  });

  test('after a submission prompt, Rubric, n and m are frozen (BR-98)', async () => {
    const row = assignmentRow({ _count: { submissions: 2 } });
    const changes = [
      { prompt: 'Changed' },
      { maxConsecutiveAttempts: 9 },
      { lockoutHours: 1 },
      { rubric: [{ name: 'Z', description: 'Z', maxPoints: 5 }] },
    ];
    for (const change of changes) {
      const { assessments, calls } = build({ row });
      await rejectsWith(
        assessments.updateAssignment(instructor, ASSIGNMENT, change),
        ConflictException,
        'ASSIGNMENT_HAS_SUBMISSIONS',
      );
      assert.equal(calls.updates.length, 0);
    }
  });

  test('re-sending the current frozen values is not a change', async () => {
    const { assessments } = build({
      row: assignmentRow({ _count: { submissions: 2 } }),
    });
    await assessments.updateAssignment(instructor, ASSIGNMENT, {
      prompt: 'Describe the procedure.',
      maxConsecutiveAttempts: 3,
      lockoutHours: 24,
      rubric: [
        { name: 'Completeness', description: 'Completeness', maxPoints: 40 },
        { name: 'Clarity', description: 'Clarity', maxPoints: 60 },
      ],
    });
  });

  test('the estimated effort always changes, even with submissions on a Locked Course (BR-173)', async () => {
    const { assessments, calls } = build({
      row: assignmentRow({ _count: { submissions: 5 } }),
      course: { locked: true },
    });
    await assessments.updateAssignment(instructor, ASSIGNMENT, {
      expectedDurationMinutes: 120,
    });
    assert.deepEqual(calls.updates[0], { expectedDurationMinutes: 120 });
    assert.equal(calls.outbox[0].eventType, 'AssignmentDurationChanged');
    assert.equal(calls.outbox[0].payload.expectedDurationMinutes, 120);
    assert.equal(calls.outbox[0].payload.previousExpectedDurationMinutes, 60);
  });

  test('the passing score is fixed once the Course is Locked (BR-319)', async () => {
    const { assessments } = build({ course: { locked: true } });
    await rejectsWith(
      assessments.updateAssignment(instructor, ASSIGNMENT, {
        passingScore: 80,
      }),
      ConflictException,
      'PASSING_SCORE_LOCKED',
    );
    // sending the same score, or changing display-only fields, is fine
    const ok = build({ course: { locked: true } });
    await ok.assessments.updateAssignment(instructor, ASSIGNMENT, {
      passingScore: 70,
      title: 'Renamed',
    });
    assert.deepEqual(ok.calls.updates[0], { title: 'Renamed' });
  });

  test('the prompt cannot be emptied unless a file remains', async () => {
    const { assessments } = build();
    await rejectsWith(
      assessments.updateAssignment(instructor, ASSIGNMENT, { prompt: '  ' }),
      BadRequestException,
      'ASSIGNMENT_PROMPT_REQUIRED',
    );
    const withFile = build({
      row: assignmentRow({ promptFileKey: 'file-key' }),
    });
    await withFile.assessments.updateAssignment(instructor, ASSIGNMENT, {
      prompt: '  ',
    });
    assert.equal(withFile.calls.updates[0].prompt, null);
  });

  test('a Course in review, archived or disabled accepts no change at all', async () => {
    for (const course of [
      { status: 'Submitted' },
      { status: 'Archived' },
      { disabled: true },
    ]) {
      const { assessments } = build({ course });
      await rejectsWith(
        assessments.updateAssignment(instructor, ASSIGNMENT, {
          expectedDurationMinutes: 10,
        }),
        ConflictException,
        'COURSE_NOT_EDITABLE',
      );
    }
  });

  test('an empty patch writes nothing', async () => {
    const { assessments, calls } = build();
    await assessments.updateAssignment(instructor, ASSIGNMENT, {});
    assert.equal(calls.updates.length, 0);
    assert.equal(calls.outbox.length, 0);
  });

  test('a submission that lands after the first read is still caught (row lock re-check)', async () => {
    const { assessments, calls } = build({
      row: assignmentRow({ _count: { submissions: 0 } }),
      lockedSubmissionCount: 1,
    });
    await rejectsWith(
      assessments.updateAssignment(instructor, ASSIGNMENT, { prompt: 'Race' }),
      ConflictException,
      'ASSIGNMENT_HAS_SUBMISSIONS',
    );
    assert.equal(calls.updates.length, 0);
  });

  test('another Instructor or an unknown Assignment is not found', async () => {
    await rejectsWith(
      build({
        course: { instructorId: OTHER_INSTRUCTOR },
      }).assessments.updateAssignment(instructor, ASSIGNMENT, { title: 'x' }),
      NotFoundException,
    );
    await rejectsWith(
      build({ row: null }).assessments.updateAssignment(
        instructor,
        ASSIGNMENT,
        {
          title: 'x',
        },
      ),
      NotFoundException,
    );
  });
});

describe('deleteAssignment (UC19.4)', () => {
  test('deletes an unused Assignment and tells the Course to drop its duration', async () => {
    const { assessments, calls } = build();
    const result = await assessments.deleteAssignment(instructor, ASSIGNMENT);
    assert.deepEqual(result, { id: ASSIGNMENT });
    assert.deepEqual(calls.deleted, [ASSIGNMENT]);
    assert.equal(calls.outbox[0].eventType, 'AssignmentDeleted');
    assert.equal(calls.outbox[0].payload.expectedDurationMinutes, 60);
  });

  test('on a Locked Course only an Assignment without data can go (BR-92)', async () => {
    const unused = build({ course: { locked: true } });
    await unused.assessments.deleteAssignment(instructor, ASSIGNMENT);
    assert.equal(unused.calls.deleted.length, 1);

    const used = build({
      row: assignmentRow({ _count: { submissions: 3 } }),
      course: { locked: true },
    });
    await rejectsWith(
      used.assessments.deleteAssignment(instructor, ASSIGNMENT),
      ConflictException,
      'ASSIGNMENT_HAS_DATA',
    );
    assert.equal(used.calls.deleted.length, 0);
  });

  test('a submission that lands after the first read blocks the delete on a Locked Course', async () => {
    const { assessments, calls } = build({
      course: { locked: true },
      lockedSubmissionCount: 1,
    });
    await rejectsWith(
      assessments.deleteAssignment(instructor, ASSIGNMENT),
      ConflictException,
      'ASSIGNMENT_HAS_DATA',
    );
    assert.equal(calls.deleted.length, 0);
  });

  test('a Course in review, archived or disabled accepts no delete', async () => {
    for (const course of [{ status: 'Submitted' }, { disabled: true }]) {
      const { assessments, calls } = build({ course });
      await rejectsWith(
        assessments.deleteAssignment(instructor, ASSIGNMENT),
        ConflictException,
        'COURSE_NOT_EDITABLE',
      );
      assert.equal(calls.deleted.length, 0);
    }
  });

  test('another Instructor, a Learner or a vanished row are refused', async () => {
    await rejectsWith(
      build({
        course: { instructorId: OTHER_INSTRUCTOR },
      }).assessments.deleteAssignment(instructor, ASSIGNMENT),
      NotFoundException,
    );
    await rejectsWith(
      build().assessments.deleteAssignment(asRole('LEARNER'), ASSIGNMENT),
      ForbiddenException,
    );
    await rejectsWith(
      build({ rowStillExists: false }).assessments.deleteAssignment(
        instructor,
        ASSIGNMENT,
      ),
      NotFoundException,
    );
  });
});
