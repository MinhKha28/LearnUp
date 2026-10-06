/**
 * In-memory stand-ins for Prisma and Course Service so the services can be unit tested without a database.
 * Every write the service makes is recorded in `calls` for the assertions.
 */
import assert from 'node:assert/strict';
import type { CurrentUser } from '@learnup/ts-common';
import { AssessmentsService } from '../../src/modules/assessments/assessments.service';
import {
  CourseAuthoringContext,
  CourseServiceClient,
} from '../../src/infrastructure/clients/course/course-service.client';
import { PeerReviewService } from '../../src/modules/peer-review/peer-review.service';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { RubricsService } from '../../src/modules/rubrics/rubrics.service';
import type {
  IStorageFileInput,
  IStorageProvider,
  IStorageUploadOptions,
  IStoredFile,
} from '@learnup/ts-storage';

/** Cloudinary stand-in: files stay in memory, keyed like the real storage hands them out. */
export class MemoryStorage implements IStorageProvider {
  readonly files = new Map<string, Buffer>();
  readonly uploads: { folder: string; resourceType?: string }[] = [];
  readonly deleted: string[] = [];

  upload(
    file: IStorageFileInput,
    options: IStorageUploadOptions,
  ): Promise<IStoredFile> {
    const publicId = `${options.folder}/${this.files.size + 1}`;
    this.files.set(publicId, file.buffer);
    this.uploads.push({
      folder: options.folder,
      resourceType: options.resourceType,
    });
    return Promise.resolve({
      storageKey: publicId,
      publicId,
      url: `http://files.test/${publicId}`,
      secureUrl: `https://files.test/${publicId}`,
      resourceType: 'raw',
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    });
  }

  delete(storageKey: string): Promise<void> {
    this.files.delete(storageKey);
    this.deleted.push(storageKey);
    return Promise.resolve();
  }

  getUrl(storageKey: string): string {
    return `https://files.test/${storageKey}`;
  }
}

export const ORG = '00000000-0000-4000-8000-000000000001';
export const INSTRUCTOR = '00000000-0000-4000-8000-000000000002';
export const OTHER_INSTRUCTOR = '00000000-0000-4000-8000-0000000000aa';
export const COURSE = '00000000-0000-4000-8000-000000000004';
export const ASSIGNMENT = '00000000-0000-4000-8000-0000000000a1';

export const instructor: CurrentUser = {
  userId: INSTRUCTOR,
  organizationId: ORG,
  role: 'INSTRUCTOR',
  isAuthenticated: true,
};

export const asRole = (role: CurrentUser['role']): CurrentUser => ({
  ...instructor,
  role,
});

export interface RubricRowFake {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  position: number;
}

/** A stored Assignment as Prisma would return it (Decimals are plain numbers, which `Number()` accepts). */
export function assignmentRow(over: Record<string, unknown> = {}) {
  return {
    id: ASSIGNMENT,
    organizationId: ORG,
    courseId: COURSE,
    kind: 'ASSIGNMENT',
    title: 'Safety Assignment',
    position: 1,
    passingScore: 70,
    maxConsecutiveAttempts: 3,
    lockoutHours: 24,
    isRequired: true,
    prompt: 'Describe the procedure.',
    promptFileKey: null,
    promptFileName: null,
    promptFileMime: null,
    promptFileSizeBytes: null,
    expectedDurationMinutes: 60,
    peerReviewEnabled: false,
    peerReviewersPerSubmission: null,
    peerReviewCycleDays: null,
    peerReviewDeadlineDays: null,
    peerReviewScoreGap: null,
    disabledAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    rubricCriteria: [
      {
        id: 'r1',
        name: 'Completeness',
        description: 'Completeness',
        maxPoints: 40,
        position: 1,
      },
      {
        id: 'r2',
        name: 'Clarity',
        description: 'Clarity',
        maxPoints: 60,
        position: 2,
      },
    ] as RubricRowFake[],
    _count: { submissions: 0 },
    ...over,
  };
}

export type AssignmentRowFake = ReturnType<typeof assignmentRow>;

export const draftCourse = (
  over: Partial<CourseAuthoringContext> = {},
): CourseAuthoringContext => ({
  courseId: COURSE,
  organizationId: ORG,
  instructorId: INSTRUCTOR,
  status: 'Draft',
  locked: false,
  disabled: false,
  ...over,
});

class StubCourseClient extends CourseServiceClient {
  constructor(private readonly ctx: CourseAuthoringContext) {
    super();
  }
  getAuthoringContext(): Promise<CourseAuthoringContext> {
    return Promise.resolve(this.ctx);
  }
}

export interface BuildOptions {
  row?: AssignmentRowFake | null;
  rows?: AssignmentRowFake[];
  course?: Partial<CourseAuthoringContext>;
  settings?: Record<string, number> | null;
  /** Highest `position` already used on the Course. */
  maxPosition?: number;
  /** Submission count seen after the row lock; differs from the first read to simulate a race. */
  lockedSubmissionCount?: number;
  /** false = the row vanished between the first read and the lock. */
  rowStillExists?: boolean;
  /** Other Assignments that still use the same prompt file key. */
  sharedFileUsers?: number;
}

export interface Calls {
  created: Record<string, unknown> | null;
  updates: Record<string, unknown>[];
  deleted: string[];
  rubricRows: Omit<RubricRowFake, 'id'>[];
  rubricDeletes: number;
  outbox: { eventType: string; payload: Record<string, unknown> }[];
}

export function build(opts: BuildOptions = {}) {
  const row = opts.row === undefined ? assignmentRow() : opts.row;
  const calls: Calls = {
    created: null,
    updates: [],
    deleted: [],
    rubricRows: [],
    rubricDeletes: 0,
    outbox: [],
  };
  const merged = () => ({
    ...(row ?? assignmentRow()),
    ...(calls.created ?? {}),
    ...Object.assign({}, ...calls.updates),
  });

  const tx = {
    $executeRaw: () => Promise.resolve(0),
    $queryRaw: () =>
      Promise.resolve(opts.rowStillExists === false ? [] : [{ id: row?.id }]),
    submission: {
      count: () =>
        Promise.resolve(
          opts.lockedSubmissionCount ?? row?._count.submissions ?? 0,
        ),
    },
    assessment: {
      aggregate: () =>
        Promise.resolve({ _max: { position: opts.maxPosition ?? null } }),
      create: ({ data }: { data: Record<string, unknown> }) => {
        calls.created = { ...data, id: 'new-assignment-id' };
        return Promise.resolve(calls.created);
      },
      update: ({ data }: { data: Record<string, unknown> }) => {
        calls.updates.push(data);
        return Promise.resolve(merged());
      },
      delete: ({ where }: { where: { id: string } }) => {
        calls.deleted.push(where.id);
        return Promise.resolve({});
      },
      findUniqueOrThrow: () => {
        const base = merged();
        // After a Rubric write the stored criteria are the ones just created.
        const rubricCriteria = calls.rubricRows.length
          ? calls.rubricRows.map((r, i) => ({ id: `new-r${i}`, ...r }))
          : base.rubricCriteria;
        return Promise.resolve({
          ...base,
          rubricCriteria,
          _count: { submissions: 0 },
        });
      },
    },
    rubricCriterion: {
      createMany: ({ data }: { data: Omit<RubricRowFake, 'id'>[] }) => {
        calls.rubricRows = data;
        return Promise.resolve({ count: data.length });
      },
      deleteMany: () => {
        calls.rubricDeletes += 1;
        return Promise.resolve({ count: 0 });
      },
    },
    outboxEvent: {
      create: ({
        data,
      }: {
        data: { eventType: string; payload: Record<string, unknown> };
      }) => {
        calls.outbox.push(data);
        return Promise.resolve({});
      },
    },
  };

  const prisma = {
    platformSetting: {
      findFirst: () => Promise.resolve(opts.settings ?? null),
    },
    assessment: {
      findMany: () => Promise.resolve(opts.rows ?? (row ? [row] : [])),
      findFirst: () => Promise.resolve(row),
      count: () => Promise.resolve(opts.sharedFileUsers ?? 0),
      update: tx.assessment.update,
    },
    $transaction: <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as PrismaService;

  const courses = new StubCourseClient(draftCourse(opts.course));
  const rubrics = new RubricsService();
  const storage = new MemoryStorage();
  return {
    calls,
    storage,
    assessments: new AssessmentsService(prisma, courses, rubrics, storage),
    peerReview: new PeerReviewService(
      prisma,
      new AssessmentsService(prisma, courses, rubrics, storage),
    ),
  };
}

/** The promise must reject with an HttpException of the given class and `code` in its body. */
export async function rejectsWith(
  promise: Promise<unknown>,
  ErrorClass: new (...args: never[]) => Error,
  code?: string,
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(
      error instanceof ErrorClass,
      `expected ${ErrorClass.name}, got ${(error as Error)?.constructor?.name}: ${(error as Error)?.message}`,
    );
    if (code !== undefined) {
      const body = (
        error as unknown as { getResponse: () => { code?: string } }
      ).getResponse();
      assert.equal(body.code, code);
    }
    return true;
  });
}
