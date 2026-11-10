import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import type { IStorageProvider } from '@learnup/ts-storage';
import type { PrismaService } from '@infra/prisma/prisma.service';
import type { AssessmentClient } from '@infra/clients/assessment/assessment.client';
import type { LearningClient } from '@infra/clients/learning/learning.client';
import type { NotificationClient } from '@infra/clients/notification/notification.client';
import type { TenantClient } from '@infra/clients/tenant/tenant.client';
import { COURSE_TRASH_MS } from './course-trash.constants';
import { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';
import type { UpdateCourseDto } from './dto/update-course.dto';

const organizationId = '01900000-0000-7000-8000-00000000a001';
const instructorId = '01900000-0000-7000-8000-00000000a011';
const courseId = '01900000-0000-7000-8000-00000000c001';
const chainId = '01900000-0000-7000-8000-00000000c002';
const moduleId = '01900000-0000-7000-8000-00000000c003';
const lessonId = '01900000-0000-7000-8000-00000000c004';
const owner: CurrentUser = {
  organizationId,
  userId: instructorId,
  role: 'INSTRUCTOR',
  isAuthenticated: true,
};
const ownership = { organizationId, courseId, instructorId };

const mockAsync = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();
const tx = {
  $queryRaw: mockAsync(),
  $executeRaw: mockAsync(),
  course: {
    findFirst: mockAsync(),
    findUnique: mockAsync(),
    update: mockAsync(),
    updateMany: mockAsync(),
    count: mockAsync(),
    delete: mockAsync(),
  },
  courseChain: { delete: mockAsync() },
  courseModule: { create: mockAsync() },
  lesson: {
    findFirst: mockAsync(),
    create: mockAsync(),
    updateMany: mockAsync(),
  },
  material: {
    count: mockAsync(),
    create: mockAsync(),
    findFirst: mockAsync(),
    update: mockAsync(),
  },
  mediaFile: {
    aggregate: mockAsync(),
    updateMany: mockAsync(),
    findUniqueOrThrow: mockAsync(),
    create: mockAsync(),
  },
  platformSetting: { findFirst: mockAsync() },
  outboxEvent: { create: mockAsync() },
};
const prisma = {
  ...tx,
  $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
    callback(tx),
};
const learning = {
  hasEverEnrolled: mockAsync(),
  hasAnyLearnerCompletedLesson: mockAsync(),
};
const assessment = {
  deleteCourseAssessments: mockAsync(),
  getCourseQuizzes: mockAsync(),
};
const storage = { delete: mockAsync(), upload: mockAsync() };
const tenant = { getInstructorMaterialUploadPolicy: mockAsync() };
const repository = new CoursesRepository(prisma as unknown as PrismaService);
const service = new CoursesService(
  repository,
  tenant as unknown as TenantClient,
  learning as unknown as LearningClient,
  assessment as unknown as AssessmentClient,
  {} as NotificationClient,
  storage as unknown as IStorageProvider,
);

const trashedCourse = () => ({
  id: courseId,
  chainId,
  status: 'Rejected',
  rejectionReason: 'Revise the outcomes',
  deletedAt: new Date(),
  coverFileId: null,
  chain: { instructorId },
  modules: [],
});

function expectNoPurge() {
  expect(tx.course.delete).not.toHaveBeenCalled();
  expect(tx.courseChain.delete).not.toHaveBeenCalled();
  expect(tx.mediaFile.updateMany).not.toHaveBeenCalled();
  expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  expect(assessment.deleteCourseAssessments).not.toHaveBeenCalled();
  expect(storage.delete).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.resetAllMocks();
  tx.$queryRaw.mockResolvedValue([{ id: courseId }]);
});

describe('Course restore', () => {
  it('restores the previous state without changing the rejection reason', async () => {
    const course = trashedCourse();
    tx.course.findFirst
      .mockResolvedValueOnce(course)
      .mockResolvedValueOnce(course)
      .mockResolvedValueOnce(null);

    await expect(service.restore(owner, courseId)).resolves.toEqual({
      courseId,
      restored: true,
    });
    expect(tx.course.update).toHaveBeenCalledWith({
      where: { id: courseId },
      data: { deletedAt: null, deletedBy: null },
    });
  });

  it.each(['Draft', 'Submitted', 'Rejected'])(
    'returns 409 when another %s version exists outside Trash',
    async (status) => {
      const course = trashedCourse();
      tx.course.findFirst
        .mockResolvedValueOnce(course)
        .mockResolvedValueOnce(course)
        .mockResolvedValueOnce({ id: 'other-course', status });

      await expect(service.restore(owner, courseId)).rejects.toMatchObject({
        status: 409,
        response: { code: 'COURSE_DRAFT_VERSION_CONFLICT' },
      });
      expect(tx.course.findFirst).toHaveBeenNthCalledWith(3, {
        where: {
          chainId,
          id: { not: courseId },
          deletedAt: null,
          status: { in: ['Draft', 'Submitted', 'Rejected'] },
        },
        select: { id: true },
      });
      expect(tx.course.update).not.toHaveBeenCalled();
    },
  );

  it('returns 409 at or after the seven-day expiry', async () => {
    const course = {
      ...trashedCourse(),
      deletedAt: new Date(Date.now() - COURSE_TRASH_MS),
    };
    tx.course.findFirst.mockResolvedValue(course);

    await expect(service.restore(owner, courseId)).rejects.toMatchObject({
      status: 409,
      response: { code: 'COURSE_TRASH_EXPIRED' },
    });
    expect(tx.course.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a Course outside Instructor ownership', async () => {
    tx.course.findFirst.mockResolvedValue(null);

    await expect(service.restore(owner, courseId)).rejects.toMatchObject({
      status: 404,
      response: { code: 'COURSE_NOT_FOUND' },
    });
    expect(tx.course.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: courseId,
          organizationId,
          chain: { instructorId },
          deletedAt: { not: null },
        },
      }),
    );
    expect(tx.course.update).not.toHaveBeenCalled();
  });

  it('returns 404 if the target disappears before the locks are acquired', async () => {
    tx.course.findFirst
      .mockResolvedValueOnce(trashedCourse())
      .mockResolvedValueOnce(null);

    await expect(service.restore(owner, courseId)).rejects.toMatchObject({
      status: 404,
      response: { code: 'COURSE_NOT_FOUND' },
    });
    expect(tx.course.update).not.toHaveBeenCalled();
  });
});

describe('Permanent Course purge', () => {
  it('keeps shared cover and material files and the remaining chain', async () => {
    const sharedCover = 'shared-cover';
    const sharedMaterial = 'shared-material';
    const exclusive = 'exclusive-material';
    const course = {
      ...trashedCourse(),
      coverFileId: sharedCover,
      modules: [
        {
          lessons: [
            { materials: [{ fileId: sharedMaterial }, { fileId: exclusive }] },
          ],
        },
      ],
    };
    tx.course.findFirst.mockResolvedValue(course);
    tx.course.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    tx.material.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    tx.mediaFile.updateMany.mockResolvedValue({ count: 1 });
    tx.mediaFile.findUniqueOrThrow.mockResolvedValue({
      storageKey: 'exclusive-object',
      mimeType: 'application/pdf',
      deliveryType: 'authenticated',
    });

    await expect(service.permanentDelete(owner, courseId)).resolves.toEqual({
      courseId,
      permanentlyDeleted: true,
      chainDeleted: false,
      releasedFileCount: 1,
      cleanupPending: true,
    });
    expect(tx.course.delete).toHaveBeenCalledTimes(1);
    expect(tx.course.delete).toHaveBeenCalledWith({ where: { id: courseId } });
    expect(tx.courseChain.delete).not.toHaveBeenCalled();
    expect(tx.mediaFile.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.mediaFile.updateMany).toHaveBeenCalledWith({
      where: {
        id: exclusive,
        organizationId,
        status: 'Ready',
        releasedAt: null,
      },
      data: { releasedAt: expect.any(Date) },
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'CourseDeleted',
        payload: {
          courseId,
          chainId,
          organizationId,
          instructorId,
          releasedFiles: [
            {
              storageKey: 'exclusive-object',
              resourceType: 'raw',
              deliveryType: 'authenticated',
            },
          ],
        },
      }),
    });
    expect(storage.delete).not.toHaveBeenCalled();
    expect(assessment.deleteCourseAssessments).not.toHaveBeenCalled();
  });

  it('removes the chain when purging its last version', async () => {
    tx.course.findFirst.mockResolvedValue(trashedCourse());
    tx.course.count.mockResolvedValue(0);

    await expect(
      service.permanentDelete(owner, courseId),
    ).resolves.toMatchObject({
      permanentlyDeleted: true,
      chainDeleted: true,
      releasedFileCount: 0,
    });
    expect(tx.courseChain.delete).toHaveBeenCalledWith({
      where: { id: chainId },
    });
  });

  it.each([
    ['missing in the Organization', null, null],
    ['outside Instructor ownership', { chainId }, null],
  ])('returns 404 for a Course %s', async (_case, initial, owned) => {
    tx.course.findFirst
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(owned);

    await expect(
      service.permanentDelete(owner, courseId),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'COURSE_NOT_FOUND' },
    });
    expectNoPurge();
  });

  it('returns 409 for a Course outside Trash', async () => {
    tx.course.findFirst.mockResolvedValue({
      ...trashedCourse(),
      deletedAt: null,
    });

    await expect(
      service.permanentDelete(owner, courseId),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'COURSE_NOT_IN_TRASH' },
    });
    expectNoPurge();
  });

  it('skips automatic purge before the recovery window expires', async () => {
    tx.course.findFirst.mockResolvedValue(trashedCourse());

    await expect(
      repository.permanentDeleteCourse({
        organizationId,
        courseId,
        requireExpired: true,
      }),
    ).resolves.toEqual({ status: 'NOT_EXPIRED' });
    expectNoPurge();
  });
});

describe('Trash ownership and enrollment history', () => {
  it.each([
    ['restore', 'non-Instructor', { ...owner, role: 'LEARNER' as const }],
    [
      'restore',
      'missing Organization',
      { ...owner, organizationId: undefined },
    ],
    [
      'permanentDelete',
      'non-Instructor',
      { ...owner, role: 'LEARNER' as const },
    ],
    [
      'permanentDelete',
      'missing Organization',
      { ...owner, organizationId: undefined },
    ],
  ] as const)('%s rejects %s before writing', async (method, _case, caller) => {
    await expect(service[method](caller, courseId)).rejects.toMatchObject({
      status: 403,
    });
    expect(tx.course.update).not.toHaveBeenCalled();
    expectNoPurge();
  });

  it('returns 409 and leaves the Course alone when Learning reports prior enrollment', async () => {
    learning.hasEverEnrolled.mockResolvedValue(true);

    await expect(service.softDelete(owner, courseId)).rejects.toMatchObject({
      status: 409,
      response: { code: 'COURSE_HAS_ENROLLMENT' },
    });
    expect(learning.hasEverEnrolled).toHaveBeenCalledWith(owner, courseId);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.course.update).not.toHaveBeenCalled();
    expectNoPurge();
  });

  it('moves an eligible Course to Trash when Learning reports no history', async () => {
    learning.hasEverEnrolled.mockResolvedValue(false);
    tx.course.findUnique.mockResolvedValue({
      id: courseId,
      status: 'Draft',
      deletedAt: null,
      lockedAt: null,
    });

    const result = await service.softDelete(owner, courseId);
    expect(result.courseId).toBe(courseId);
    expect(result.purgeAt.getTime() - result.deletedAt.getTime()).toBe(
      COURSE_TRASH_MS,
    );
    expect(tx.course.update).toHaveBeenCalledWith({
      where: { id: courseId },
      data: { deletedAt: result.deletedAt, deletedBy: instructorId },
    });
    expectNoPurge();
  });

  it('keeps the Course when Learning history is unavailable', async () => {
    learning.hasEverEnrolled.mockRejectedValue(
      new ServiceUnavailableException({
        code: 'ENROLLMENT_CHECK_UNAVAILABLE',
      }),
    );

    await expect(service.softDelete(owner, courseId)).rejects.toMatchObject({
      status: 503,
      response: { code: 'ENROLLMENT_CHECK_UNAVAILABLE' },
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.course.update).not.toHaveBeenCalled();
    expectNoPurge();
  });
});

const courseDetails: UpdateCourseDto = {
  name: 'Updated Course',
  shortDescription: 'Description',
  trainingObjectives: 'Objectives',
  learningOutcomes: ['Outcome'],
  expectedCompletionDays: 7,
  coverFileId: null,
  courseType: 'Private',
};
const upload = { title: 'New material', isRequired: false };
const file = {
  buffer: Buffer.from('fixture'),
  originalname: 'fixture',
} as Express.Multer.File;
const material = {
  ...ownership,
  ...upload,
  lessonId,
  maxStorageBytes: 100n,
  file: {
    storageKey: 'test-object',
    deliveryType: 'authenticated',
    storageFormat: 'pdf',
    originalFilename: 'fixture',
    mimeType: 'application/pdf',
    sizeBytes: 7,
    durationSeconds: 1,
    wordCount: 1,
  },
};

const materialId = '01900000-0000-7000-8000-00000000c005';
const replacementBuffer = Buffer.from('0000ftyp0000');
const replacementVideo = {
  buffer: replacementBuffer,
  size: replacementBuffer.length,
  originalname: 'replacement.mp4',
  mimetype: 'video/mp4',
} as Express.Multer.File;

describe('BR-340 write guard', () => {
  const inTrash = { status: 409, response: { code: 'COURSE_IN_TRASH' } };

  function expectNoWrite() {
    expect(tx.course.updateMany).not.toHaveBeenCalled();
    expect(tx.courseModule.create).not.toHaveBeenCalled();
    expect(tx.lesson.create).not.toHaveBeenCalled();
    expect(tx.lesson.updateMany).not.toHaveBeenCalled();
    expect(tx.material.create).not.toHaveBeenCalled();
    expect(tx.material.update).not.toHaveBeenCalled();
    expect(tx.mediaFile.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(learning.hasAnyLearnerCompletedLesson).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(assessment.getCourseQuizzes).not.toHaveBeenCalled();
  }

  it.each([
    [
      'edit details',
      () => service.updateCourse(owner, courseId, courseDetails),
    ],
    [
      'edit structure',
      () => service.updateStructure(owner, courseId, { modules: [] }),
    ],
    [
      'create a Module',
      () => service.createModule(owner, courseId, { title: 'Module' }),
    ],
    [
      'create a Lesson',
      () =>
        service.createLesson(owner, courseId, moduleId, {
          title: 'Lesson',
          content: 'Content',
        }),
    ],
    [
      'edit Lesson content',
      () =>
        service.updateLessonContent(owner, courseId, lessonId, {
          content: 'Content',
        }),
    ],
    [
      'upload a Video',
      () =>
        service.uploadVideoMaterial(owner, courseId, lessonId, upload, file),
    ],
    [
      'upload a Reading',
      () =>
        service.uploadReadingMaterial(owner, courseId, lessonId, upload, file),
    ],
    ['submit', () => service.submitCourseForApproval(owner, courseId)],
  ] as const)(
    'returns 409 when asked to %s for a trashed Course',
    async (_action, write) => {
      const course = trashedCourse();
      tx.course.findFirst.mockResolvedValue(course);
      tx.lesson.findFirst.mockResolvedValue({ module: { course } });
      tx.$queryRaw.mockResolvedValue([{ deletedAt: course.deletedAt }]);

      await expect(write()).rejects.toMatchObject(inTrash);
      expectNoWrite();
    },
  );

  it.each([
    [
      'Module creation',
      () =>
        repository.createModule(
          organizationId,
          courseId,
          instructorId,
          'Module',
        ),
    ],
    [
      'Lesson creation',
      () =>
        repository.createLesson(
          organizationId,
          courseId,
          instructorId,
          moduleId,
          'Lesson',
          'Content',
        ),
    ],
    [
      'Lesson content update',
      () =>
        repository.updateLessonContent(
          courseId,
          lessonId,
          organizationId,
          instructorId,
          'Content',
          new Date(),
        ),
    ],
    ['Video insert', () => repository.createVideoMaterialWithQuota(material)],
    [
      'Reading insert',
      () => repository.createReadingMaterialWithQuota(material),
    ],
  ] as const)(
    'checks trash under the Course lock before %s',
    async (_action, write) => {
      tx.$queryRaw.mockResolvedValue([{ deletedAt: new Date() }]);

      await expect(write()).rejects.toMatchObject(inTrash);
      const lockCall = tx.$queryRaw.mock.calls.at(-1);
      expect(lockCall).toEqual([
        expect.arrayContaining([expect.stringContaining('FOR UPDATE OF c')]),
        courseId,
        organizationId,
        instructorId,
      ]);
      expectNoWrite();
    },
  );

  it('rejects material metadata edits while the Course is in Trash', async () => {
    tx.$queryRaw.mockResolvedValue([{ deletedAt: new Date() }]);

    await expect(
      service.updateMaterial(owner, courseId, lessonId, materialId, {
        title: 'Updated title',
      }),
    ).rejects.toMatchObject(inTrash);
    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('FOR UPDATE OF c')]),
      courseId,
      organizationId,
      instructorId,
    );
    expectNoWrite();
  });

  function replaceVideo() {
    return service.replaceTechnicalFile(
      owner,
      courseId,
      lessonId,
      materialId,
      replacementVideo,
    );
  }

  it('rejects a file replacement for a trashed Course before upload', async () => {
    tx.material.findFirst.mockResolvedValue({
      lesson: { module: { course: trashedCourse() } },
    });

    await expect(replaceVideo()).rejects.toMatchObject(inTrash);
    expectNoWrite();
  });

  it('rejects a Course trashed during replacement and deletes the new upload', async () => {
    const replacementFile = {
      storageKey: 'test/replacement',
      resourceType: 'video',
      deliveryType: 'authenticated',
      sizeBytes: replacementVideo.size,
      durationSeconds: 1,
      format: 'mp4',
    };
    tx.material.findFirst.mockResolvedValue({
      materialType: 'Video',
      file: {
        status: 'Ready',
        releasedAt: null,
        sizeBytes: 12n,
        storageKey: 'test/original',
      },
      lesson: {
        disabledAt: null,
        module: {
          course: { status: 'Draft', disabledAt: null, deletedAt: null },
        },
      },
    });
    tx.platformSetting.findFirst.mockResolvedValue({
      maxVideoSizeBytes: 1000n,
      maxVideoDurationMinutes: 1,
      allowedVideoMimeTypes: ['video/mp4'],
    });
    tx.mediaFile.aggregate.mockResolvedValue({ _sum: { sizeBytes: 12n } });
    tenant.getInstructorMaterialUploadPolicy.mockResolvedValue({
      canUpload: true,
      maxStorageBytes: 1000,
    });
    storage.upload.mockImplementation(async () => {
      tx.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ deletedAt: new Date() }]);
      return replacementFile;
    });

    await expect(replaceVideo()).rejects.toMatchObject(inTrash);
    expect(tx.$queryRaw).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.stringContaining('FOR UPDATE OF c')]),
      courseId,
      organizationId,
      instructorId,
    );
    expect(tx.material.update).not.toHaveBeenCalled();
    expect(tx.mediaFile.updateMany).not.toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith(replacementFile.storageKey, {
      resourceType: 'video',
      deliveryType: 'authenticated',
    });
  });

  it('returns the trash error when the Course moves to Trash during submission', async () => {
    const course = {
      ...courseDetails,
      status: 'Draft',
      updatedAt: new Date(),
      deletedAt: null,
    };
    tx.course.findFirst
      .mockResolvedValueOnce(course)
      .mockResolvedValueOnce(trashedCourse());
    assessment.getCourseQuizzes.mockResolvedValue([{ questionCount: 1 }]);
    tx.course.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.submitCourseForApproval(owner, courseId),
    ).rejects.toMatchObject(inTrash);
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
