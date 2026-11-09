import type { CurrentUser } from '@learnup/ts-common';
import { COURSE_STATUS } from './course-values';
import { CoursesService } from './courses.service';
import type { CoursesRepository } from './courses.repository';
import type { AssessmentClient } from '@/infrastructure/clients/assessment/assessment.client';
import type { TenantClient } from '@infra/clients/tenant/tenant.client';
import type { LearningClient } from '@infra/clients/learning/learning.client';
import type { NotificationClient } from '@/infrastructure/clients/notification/notification.client';
import type { IStorageProvider } from '@learnup/ts-storage';

describe('UC20 submit Course for approval', () => {
  const courseId = '019a0000-0000-7000-8000-000000000003';
  const instructor = {
    userId: '019a0000-0000-7000-8000-000000000001',
    organizationId: '019a0000-0000-7000-8000-000000000002',
    role: 'INSTRUCTOR',
  } as CurrentUser;
  const course = {
    id: courseId,
    status: COURSE_STATUS.DRAFT,
    shortDescription: 'Short description',
    trainingObjectives: 'Objectives',
    learningOutcomes: ['Outcome'],
    updatedAt: new Date('2026-11-08T05:00:00.000Z'),
  };
  const submitted = {
    id: courseId,
    name: 'Safety Training',
    versionNumber: 1,
    status: COURSE_STATUS.SUBMITTED,
    submittedAt: new Date('2026-11-08T05:01:00.000Z'),
  };

  const repository = {
    findDetail: jest.fn(),
    submitCourseForApproval: jest.fn(),
  };
  const assessment = { getCourseQuizzes: jest.fn() };
  const service = new CoursesService(
    repository as unknown as CoursesRepository,
    {} as TenantClient,
    {} as LearningClient,
    assessment as unknown as AssessmentClient,
    {} as NotificationClient,
    {} as IStorageProvider,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    repository.findDetail.mockResolvedValue({ ...course });
    repository.submitCourseForApproval.mockResolvedValue({
      status: 'SUBMITTED',
      course: submitted,
    });
    assessment.getCourseQuizzes.mockResolvedValue([
      { id: 'quiz-id', questionCount: 1 },
    ]);
  });

  it.each([COURSE_STATUS.DRAFT, COURSE_STATUS.REJECTED])(
    'submits a %s Course', async (status) => {
      repository.findDetail.mockResolvedValue({ ...course, status });
      await expect(service.submitCourseForApproval(instructor, courseId))
        .resolves.toEqual(submitted);
      expect(repository.submitCourseForApproval).toHaveBeenCalledWith({
        courseId,
        organizationId: instructor.organizationId,
        instructorId: instructor.userId,
        expectedUpdatedAt: course.updatedAt,
      });
    },
  );

  it('forbids non-Instructors', async () => {
    await expect(service.submitCourseForApproval(
      { ...instructor, role: 'LEARNER' } as CurrentUser, courseId,
    )).rejects.toMatchObject({ status: 403 });
    expect(repository.findDetail).not.toHaveBeenCalled();
  });

  it('does not reveal another Instructor Course', async () => {
    repository.findDetail.mockResolvedValue(null);
    await expect(service.submitCourseForApproval(instructor, courseId))
      .rejects.toMatchObject({ status: 404 });
    expect(repository.submitCourseForApproval).not.toHaveBeenCalled();
  });

  it('rejects an invalid lifecycle status', async () => {
    repository.findDetail.mockResolvedValue({
      ...course, status: COURSE_STATUS.SUBMITTED,
    });
    await expect(service.submitCourseForApproval(instructor, courseId))
      .rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: 'INVALID_COURSE_STATUS' }),
      });
  });

  it.each([
    { shortDescription: null },
    { trainingObjectives: '' },
    { learningOutcomes: [] },
  ])('requires complete Course information', async (missing) => {
    repository.findDetail.mockResolvedValue({ ...course, ...missing });
    await expect(service.submitCourseForApproval(instructor, courseId))
      .rejects.toMatchObject({
        status: 400,
        response: expect.objectContaining({ code: 'INCOMPLETE_COURSE' }),
      });
    expect(assessment.getCourseQuizzes).not.toHaveBeenCalled();
  });

  it('rejects a Quiz without questions', async () => {
    assessment.getCourseQuizzes.mockResolvedValue([{ id: 'quiz', questionCount: 0 }]);
    await expect(service.submitCourseForApproval(instructor, courseId))
      .rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: 'QUIZ_WITHOUT_QUESTIONS' }),
      });
    expect(repository.submitCourseForApproval).not.toHaveBeenCalled();
  });

  it('rejects a concurrent Course modification', async () => {
    repository.submitCourseForApproval.mockResolvedValue({ status: 'CONFLICT' });
    await expect(service.submitCourseForApproval(instructor, courseId))
      .rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: 'COURSE_CHANGED' }),
      });
  });

  it('does not commit when Assessment Service fails', async () => {
    assessment.getCourseQuizzes.mockRejectedValue(new Error('Assessment down'));
    await expect(service.submitCourseForApproval(instructor, courseId))
      .rejects.toThrow('Assessment down');
    expect(repository.submitCourseForApproval).not.toHaveBeenCalled();
  });
});
