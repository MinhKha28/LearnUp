/** Business rules of UC19 / UC19.1 / UC19.2 / UC19.3 / UC19.4, with Prisma and Course Service replaced by fakes. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageProviderError } from '@learnup/ts-storage';
import type { CreateAssignmentDto } from '../../src/modules/assessments/dto/create-assignment.dto';
import {
  ASSIGNMENT,
  assignmentRow,
  asRole,
  build,
  COURSE,
  instructor,
  ORG,
  OTHER_INSTRUCTOR,
  rejectsWith,
} from './fixtures';

const OTHER_ORG = '00000000-0000-4000-8000-0000000000bb';

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
    const { assessments: withFile, media } = build();
    const { fileKey } = await media.uploadPromptFile(instructor, {
      buffer: Buffer.from('%PDF-1.4 x'),
      originalname: 'brief.pdf',
      size: 10,
    });
    const created = await withFile.createAssignment(instructor, {
      ...validCreate,
      prompt: undefined,
      promptFile: {
        fileKey,
        fileName: 'brief.pdf',
        mimeType: 'text/plain', // ignored: the type is always PDF
        sizeBytes: 10,
      },
    });
    assert.equal(created.promptFile?.fileName, 'brief.pdf');
    assert.equal(created.promptFile?.mimeType, 'application/pdf');
    assert.equal(created.promptFile?.sizeBytes, 10);
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
    for (const status of ['Draft', 'Rejected', 'Published']) {
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

  test('records AssignmentMinutesChanged so the Course can add the duration (BR-51, BR-172)', async () => {
    const { assessments, calls } = build();
    await assessments.createAssignment(instructor, validCreate);
    assert.equal(calls.outbox.length, 1);
    assert.equal(calls.outbox[0].eventType, 'AssignmentMinutesChanged');
    assert.equal(calls.outbox[0].payload.change, 'Created');
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
    // UC19 step 3: the passing score and the expected duration are on every row
    assert.deepEqual(
      page.items.map((i) => [i.passingScore, i.expectedDurationMinutes]),
      [
        [70, 60],
        [70, 60],
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
    assert.equal(calls.outbox[0].eventType, 'AssignmentMinutesChanged');
    assert.equal(calls.outbox[0].payload.change, 'DurationChanged');
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
    assert.equal(calls.outbox[0].eventType, 'AssignmentMinutesChanged');
    assert.equal(calls.outbox[0].payload.change, 'Deleted');
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

describe('Prompt file (BR-320: one PDF, 50 MB, stored outside the Assignment row)', () => {
  const pdf = (name = 'brief.pdf', size?: number) => {
    const buffer = Buffer.from('%PDF-1.4 content');
    return {
      buffer,
      originalname: name,
      size: size ?? buffer.length,
    } as Express.Multer.File;
  };

  test('a PDF is stored and the key is handed back', async () => {
    const { media, storage } = build();
    const result = await media.uploadPromptFile(instructor, pdf());
    assert.equal(result.mimeType, 'application/pdf');
    assert.equal(result.fileName, 'brief.pdf');
    assert.equal(result.sizeBytes, 16);
    assert.ok(storage.files.has(result.fileKey));
    // one folder per Organization, raw resource (a PDF is not an image)
    assert.deepEqual(storage.uploads, [
      { folder: `learnup/${ORG}/assignments/prompts`, resourceType: 'raw' },
    ]);
  });

  test('a storage that is down is a 503, not a crash', async () => {
    const { media, storage } = build();
    storage.upload = () => Promise.reject(new StorageProviderError('boom'));
    await rejectsWith(
      media.uploadPromptFile(instructor, pdf()),
      ServiceUnavailableException,
      'STORAGE_UNAVAILABLE',
    );
  });

  test('accented file names survive the latin1 reading done by the upload library', async () => {
    const { media } = build();
    const asMulterSees = Buffer.from('Đề bài.pdf', 'utf8').toString('latin1');
    const result = await media.uploadPromptFile(instructor, pdf(asMulterSees));
    assert.equal(result.fileName, 'Đề bài.pdf');
  });

  test('only an Instructor can upload', async () => {
    const { media } = build();
    await rejectsWith(
      media.uploadPromptFile(asRole('LEARNER'), pdf()),
      ForbiddenException,
      'FORBIDDEN',
    );
  });

  test('no file, a file that is not a PDF, or one over 50 MB is refused', async () => {
    const { media, storage } = build();
    await rejectsWith(
      media.uploadPromptFile(instructor, undefined),
      BadRequestException,
      'PROMPT_FILE_REQUIRED',
    );
    await rejectsWith(
      media.uploadPromptFile(instructor, {
        buffer: Buffer.from('MZ not a pdf'),
        originalname: 'virus.pdf',
        size: 12,
      }),
      BadRequestException,
      'PROMPT_FILE_NOT_PDF',
    );
    await rejectsWith(
      media.uploadPromptFile(instructor, pdf('big.pdf', 50 * 1024 * 1024 + 1)),
      BadRequestException,
      'PROMPT_FILE_TOO_LARGE',
    );
    assert.equal(storage.files.size, 0);
  });

  test("create and update only accept a key from the Organization's own prompt folder", async () => {
    const { assessments } = build();
    const ghost = {
      fileKey: `learnup/${OTHER_ORG}/assignments/prompts/1`,
      fileName: 'x.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1,
    };
    await rejectsWith(
      assessments.createAssignment(instructor, {
        ...validCreate,
        promptFile: ghost,
      }),
      BadRequestException,
      'PROMPT_FILE_NOT_FOUND',
    );
    await rejectsWith(
      assessments.updateAssignment(instructor, ASSIGNMENT, {
        promptFile: ghost,
      }),
      BadRequestException,
      'PROMPT_FILE_NOT_FOUND',
    );
  });

  test('update can swap the file, and remove it while a prompt text remains', async () => {
    const { assessments, media, storage, calls } = build({
      row: assignmentRow({ promptFileKey: 'old.pdf', prompt: 'text' }),
    });
    const { fileKey } = await media.uploadPromptFile(instructor, {
      buffer: Buffer.from('%PDF-1.7'),
      originalname: 'new.pdf',
      size: 8,
    });
    assert.ok(storage.files.has(fileKey));
    await assessments.updateAssignment(instructor, ASSIGNMENT, {
      promptFile: { fileKey, fileName: 'new.pdf', mimeType: 'x', sizeBytes: 8 },
    });
    assert.equal(calls.updates[0].promptFileKey, fileKey);
    assert.equal(calls.updates[0].promptFileSizeBytes, 8);

    await assessments.updateAssignment(instructor, ASSIGNMENT, {
      promptFile: null,
    });
    assert.equal(calls.updates[1].promptFileKey, null);
    // the replaced file is removed from storage (the removed one was never in this fake)
    assert.ok(storage.deleted.includes('old.pdf'));
  });

  test('the file can be downloaded by the Instructor in charge', async () => {
    const realFetch = globalThis.fetch;
    const answers = new Map<string, Response>([
      ['https://files.test/ok', new Response('%PDF-1.4 hello')],
      ['https://files.test/gone', new Response('', { status: 404 })],
    ]);
    globalThis.fetch = ((url: string) =>
      answers.has(url)
        ? Promise.resolve(answers.get(url)!)
        : Promise.reject(new Error('offline'))) as typeof fetch;
    try {
      const withFile = build({
        row: assignmentRow({
          promptFileKey: 'ok',
          promptFileName: 'brief.pdf',
          promptFileMime: 'application/pdf',
        }),
      });
      const out = await withFile.assessments.downloadPromptFile(
        instructor,
        ASSIGNMENT,
      );
      assert.equal(out.fileName, 'brief.pdf');
      assert.equal(out.content.toString(), '%PDF-1.4 hello');

      await rejectsWith(
        build().assessments.downloadPromptFile(instructor, ASSIGNMENT),
        NotFoundException,
        'PROMPT_FILE_NOT_FOUND',
      );
      await rejectsWith(
        build({
          row: assignmentRow({ promptFileKey: 'gone' }),
        }).assessments.downloadPromptFile(instructor, ASSIGNMENT),
        NotFoundException,
        'PROMPT_FILE_NOT_FOUND',
      );
      await rejectsWith(
        build({
          row: assignmentRow({ promptFileKey: 'unreachable' }),
        }).assessments.downloadPromptFile(instructor, ASSIGNMENT),
        ServiceUnavailableException,
        'STORAGE_UNAVAILABLE',
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  });
  test('the prompt file leaves storage with the Assignment, unless another Assignment still uses it', async () => {
    const own = build({ row: assignmentRow({ promptFileKey: 'k1' }) });
    await own.assessments.deleteAssignment(instructor, ASSIGNMENT);
    assert.deepEqual(own.storage.deleted, ['k1']);

    const shared = build({
      row: assignmentRow({ promptFileKey: 'k2' }),
      sharedFileUsers: 1,
    });
    await shared.assessments.deleteAssignment(instructor, ASSIGNMENT);
    assert.deepEqual(shared.storage.deleted, []);

    const none = build();
    await none.assessments.deleteAssignment(instructor, ASSIGNMENT);
    assert.deepEqual(none.storage.deleted, []);
  });

  test('a storage failure does not undo the delete', async () => {
    const t = build({ row: assignmentRow({ promptFileKey: 'k3' }) });
    t.storage.delete = () => Promise.reject(new Error('offline'));
    const result = await t.assessments.deleteAssignment(instructor, ASSIGNMENT);
    assert.equal(result.id, ASSIGNMENT);
    assert.deepEqual(t.calls.deleted, [ASSIGNMENT]);
  });
});

describe('the Course changes while an Assignment is created (BR-318)', () => {
  test('a Learner enrolls between the first look and the commit: the Assignment is refused (409)', async () => {
    const { assessments } = build({ courseLater: { locked: true } });
    await rejectsWith(
      assessments.createAssignment(instructor, validCreate),
      ConflictException,
      'COURSE_LOCKED',
    );
  });

  test('the Course is sent for review in between: refused too (409)', async () => {
    const { assessments } = build({ courseLater: { status: 'Submitted' } });
    await rejectsWith(
      assessments.createAssignment(instructor, validCreate),
      ConflictException,
      'COURSE_NOT_EDITABLE',
    );
  });

  test('a Course that stays as it was takes the Assignment', async () => {
    const { assessments, calls } = build({ courseLater: { locked: false } });
    await assessments.createAssignment(instructor, validCreate);
    assert.ok(calls.created);
  });
});

describe('attaching a prompt file looks at the stored file (BR-320)', () => {
  const upload = (media: ReturnType<typeof build>['media']) =>
    media.uploadPromptFile(instructor, {
      buffer: Buffer.from('%PDF-1.4 0123456789'),
      originalname: 'brief.pdf',
      size: 19,
    });
  const attach = (fileKey: string, sizeBytes = 19) => ({
    fileKey,
    fileName: 'brief.pdf',
    mimeType: 'application/pdf',
    sizeBytes,
  });

  test('a key that is not in the storage is refused (400)', async () => {
    const { assessments } = build();
    await rejectsWith(
      assessments.createAssignment(instructor, {
        ...validCreate,
        promptFile: attach(`learnup/${ORG}/assignments/prompts/never-uploaded`),
      }),
      BadRequestException,
      'PROMPT_FILE_NOT_FOUND',
    );
  });

  test('the size comes from the stored file, not from the request', async () => {
    const { assessments, media } = build();
    const { fileKey } = await upload(media);
    const created = await assessments.createAssignment(instructor, {
      ...validCreate,
      promptFile: attach(fileKey, 5), // the client says 5 bytes; the file has 19
    });
    assert.equal(created.promptFile?.sizeBytes, 19);
  });

  test('a storage that does not answer, or fails, is a 503 and nothing is attached', async () => {
    for (const answer of [null, new Response(null, { status: 502 })]) {
      const { assessments, media, calls } = build();
      const { fileKey } = await upload(media);
      media.head = () => Promise.resolve(answer);
      await rejectsWith(
        assessments.createAssignment(instructor, {
          ...validCreate,
          promptFile: attach(fileKey),
        }),
        ServiceUnavailableException,
        'STORAGE_UNAVAILABLE',
      );
      assert.equal(calls.created, null);
    }
  });

  test('a stored file over 50 MB is refused even when the request says it is small', async () => {
    const { assessments, media } = build();
    const { fileKey } = await upload(media);
    media.head = () =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: { 'content-length': String(60 * 1024 * 1024) },
        }),
      );
    await rejectsWith(
      assessments.createAssignment(instructor, {
        ...validCreate,
        promptFile: attach(fileKey, 10),
      }),
      BadRequestException,
      'PROMPT_FILE_TOO_LARGE',
    );
  });

  test('on update the same file is not looked at again, a different one is', async () => {
    const key = `learnup/${ORG}/assignments/prompts/current`;
    const { assessments, media } = build({
      row: assignmentRow({
        promptFileKey: key,
        promptFileName: 'brief.pdf',
        promptFileMime: 'application/pdf',
        promptFileSizeBytes: 19,
      }),
    });
    let heads = 0;
    media.head = () => {
      heads += 1;
      return Promise.resolve(new Response(null, { status: 404 }));
    };
    // the same key as the one stored: no look, no error
    await assessments.updateAssignment(instructor, ASSIGNMENT, {
      promptFile: attach(key),
      title: 'Same file, new title',
    });
    assert.equal(heads, 0);
    // a different key: it is looked at, and it is missing
    await rejectsWith(
      assessments.updateAssignment(instructor, ASSIGNMENT, {
        promptFile: attach(`learnup/${ORG}/assignments/prompts/other`),
      }),
      BadRequestException,
      'PROMPT_FILE_NOT_FOUND',
    );
    assert.equal(heads, 1);
  });
});

describe('discarding an uploaded prompt file that was not saved', () => {
  const key = `learnup/${ORG}/assignments/prompts/loose`;

  test('a file no Assignment uses is removed from the storage', async () => {
    const { media, storage } = build();
    const { fileKey } = await media.uploadPromptFile(instructor, {
      buffer: Buffer.from('%PDF-1.4 x'),
      originalname: 'brief.pdf',
      size: 10,
    });
    assert.deepEqual(await media.discardPromptFile(instructor, fileKey), {
      fileKey,
    });
    assert.deepEqual(storage.deleted, [fileKey]);
    assert.equal(storage.files.has(fileKey), false);
  });

  test('a file an Assignment uses is kept (409)', async () => {
    const { media, storage } = build({ sharedFileUsers: 1 });
    await rejectsWith(
      media.discardPromptFile(instructor, key),
      ConflictException,
      'PROMPT_FILE_IN_USE',
    );
    assert.deepEqual(storage.deleted, []);
  });

  test('another Organization, a path trick, or a non-Instructor is refused and nothing is removed', async () => {
    const { media, storage } = build();
    for (const fileKey of [
      `learnup/${OTHER_ORG}/assignments/prompts/loose`,
      `learnup/${ORG}/assignments/prompts/../../x`,
      'loose.pdf',
    ]) {
      await rejectsWith(
        media.discardPromptFile(instructor, fileKey),
        BadRequestException,
        'PROMPT_FILE_NOT_FOUND',
      );
    }
    await rejectsWith(
      media.discardPromptFile(asRole('LEARNER'), key),
      ForbiddenException,
      'FORBIDDEN',
    );
    assert.deepEqual(storage.deleted, []);
  });

  test('a storage that fails is a 503 the caller can ignore', async () => {
    const { media, storage } = build();
    storage.delete = () => Promise.reject(new Error('storage down'));
    await rejectsWith(
      media.discardPromptFile(instructor, key),
      ServiceUnavailableException,
      'STORAGE_UNAVAILABLE',
    );
  });
});

describe('the Course learns the Assignment minutes (BR-51, BR-172, BR-173)', () => {
  test('creating tells Course Service the total of all the Assignments, and the outbox row is done', async () => {
    const { assessments, courses, calls } = build({ minutesTotal: 150 });
    await assessments.createAssignment(instructor, validCreate);
    assert.deepEqual(
      (courses as unknown as { minutesReports: unknown[] }).minutesReports,
      [{ courseId: COURSE, minutes: 150 }],
    );
    assert.deepEqual(calls.published, ['outbox-1']);
  });

  test('a new duration is sent, the same duration is not, and a Locked Course still takes it (BR-173)', async () => {
    const same = build();
    await same.assessments.updateAssignment(instructor, ASSIGNMENT, {
      title: 'Only the title changes',
    });
    assert.equal(
      (same.courses as unknown as { minutesReports: unknown[] }).minutesReports
        .length,
      0,
    );
    const locked = build({ course: { locked: true }, minutesTotal: 120 });
    await locked.assessments.updateAssignment(instructor, ASSIGNMENT, {
      expectedDurationMinutes: 120,
    });
    assert.deepEqual(
      (locked.courses as unknown as { minutesReports: unknown[] })
        .minutesReports,
      [{ courseId: COURSE, minutes: 120 }],
    );
  });

  test('deleting tells the Course the total without it', async () => {
    const { assessments, courses, calls } = build({ minutesTotal: 30 });
    await assessments.deleteAssignment(instructor, ASSIGNMENT);
    assert.deepEqual(
      (courses as unknown as { minutesReports: unknown[] }).minutesReports,
      [{ courseId: COURSE, minutes: 30 }],
    );
    assert.deepEqual(calls.published, ['outbox-1']);
  });

  test('a Course Service that is down does not fail the action; the outbox row waits', async () => {
    const { assessments, courses, calls } = build();
    (courses as unknown as { failMinutes: boolean }).failMinutes = true;
    const created = await assessments.createAssignment(instructor, validCreate);
    assert.ok(created.id);
    assert.deepEqual(calls.published, []);
    assert.equal(calls.outbox.length, 1);
  });
});
