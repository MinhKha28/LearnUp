import type { PrismaService } from '@infra/prisma/prisma.service';
import { CoursesRepository } from './courses.repository';

describe('UC21.2 - Course Repository', () => {
  const organizationId = '019a0000-0000-7000-8000-000000000002';

  const courseId = '019a0000-0000-7000-8000-000000000001';

  const materialId = '019a0000-0000-7000-8000-000000000004';

  const courseFindFirst = jest.fn();
  const materialFindFirst = jest.fn();

  const repository = new CoursesRepository({
    course: { findFirst: courseFindFirst },
    material: { findFirst: materialFindFirst },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('uses Organization isolation for Course review', async () => {
    courseFindFirst.mockResolvedValue(null);

    await repository.findCourseForOrganizerReview(organizationId, courseId);

    expect(courseFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: courseId,
          organizationId,
          disabledAt: null,
        },
      }),
    );
  });

  it('scopes Material preview to a Submitted Course', async () => {
    materialFindFirst.mockResolvedValue(null);

    await repository.findOrganizerReviewMaterial(
      organizationId,
      courseId,
      materialId,
    );

    expect(materialFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: materialId,
          organizationId,
          lesson: expect.objectContaining({
            module: expect.objectContaining({
              courseId,
              course: {
                organizationId,
                status: 'Submitted',
                disabledAt: null,
              },
            }),
          }),
        }),
      }),
    );
  });

  it('verifies the Organization and Submitted state', async () => {
    courseFindFirst.mockResolvedValue(null);

    await repository.findOrganizerReviewAccess(organizationId, courseId);

    expect(courseFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: courseId,
          organizationId,
          status: 'Submitted',
          disabledAt: null,
        },
      }),
    );
  });
});
