import { StorageProviderError, type IReadableStorageProvider } from '@learnup/ts-storage';
import type { PrismaService } from '@infra/prisma/prisma.service';
import { InternalCoursesService } from './internal-courses.service';

describe('InternalCoursesService.getMaterialSignedUrl', () => {
  const organizationId = '01900000-0000-7000-8000-00000000a001';
  const courseId = '01900000-0000-7000-8000-c0020000008d';
  const materialId = '01a17e2a-3c38-7743-94df-355529578f67';
  const findFirst = jest.fn();
  const getSignedUrl = jest.fn();
  const prisma = { material: { findFirst } } as unknown as PrismaService;
  const storage = { getSignedUrl } as unknown as IReadableStorageProvider;
  const service = new InternalCoursesService(prisma, storage);

  function fixture() {
    return {
      materialType: 'Video',
      disabledAt: null as Date | null,
      lesson: {
        disabledAt: null as Date | null,
        module: { course: { disabledAt: null as Date | null } },
      },
      file: {
        organizationId,
        status: 'Ready',
        readyAt: new Date() as Date | null,
        releasedAt: null as Date | null,
        purpose: 'LessonVideo',
        storageKey: 'learnup/test/video',
        mimeType: 'video/mp4',
        deliveryType: 'authenticated',
        storageFormat: 'mp4',
      },
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findFirst.mockResolvedValue(fixture());
    getSignedUrl.mockReturnValue('https://example.test/protected');
  });

  it.each([
    ['Video', 'LessonVideo', 'video/mp4', 'video', 'mp4'],
    ['Reading', 'LessonReading', 'application/pdf', 'raw', ''],
  ])('generates signed URL for %s', async (type, purpose, mime, resourceType, format) => {
    findFirst.mockResolvedValue({
      ...fixture(),
      materialType: type,
      file: { ...fixture().file, purpose, mimeType: mime, storageFormat: format },
    });
    const before = Math.floor(Date.now() / 1000);
    const result = await service.getMaterialSignedUrl(organizationId, courseId, materialId);
    const after = Math.floor(Date.now() / 1000);
    expect(result.url).toBe('https://example.test/protected');
    expect(result.mimeType).toBe(mime);
    const expiresAt = Date.parse(result.expiresAt) / 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(before + 900);
    expect(expiresAt).toBeLessThanOrEqual(after + 900);
    expect(getSignedUrl).toHaveBeenCalledWith('learnup/test/video', {
      resourceType, format, deliveryType: 'authenticated', expiresAt,
    });
  });

  it.each([
    ['different organization', '01900000-0000-7000-8000-00000000a002', courseId],
    ['different course', organizationId, '01900000-0000-7000-8000-c0020000009d'],
  ])('returns 404 when lookup finds no material for %s', async (_label, org, course) => {
    findFirst.mockResolvedValue(null);
    await expect(service.getMaterialSignedUrl(org, course, materialId))
      .rejects.toMatchObject({ status: 404, response: { code: 'MATERIAL_NOT_FOUND' } });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: materialId,
        organizationId: org,
        lesson: {
          organizationId: org,
          module: { organizationId: org, courseId: course, course: { organizationId: org } },
        },
      },
    }));
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it.each(['material', 'lesson', 'course'])('returns 409 when %s disabled', async (target) => {
    const row = fixture();
    if (target === 'material') row.disabledAt = new Date();
    if (target === 'lesson') row.lesson.disabledAt = new Date();
    if (target === 'course') row.lesson.module.course.disabledAt = new Date();
    findFirst.mockResolvedValue(row);
    await expect(service.getMaterialSignedUrl(organizationId, courseId, materialId))
      .rejects.toMatchObject({ status: 409, response: { code: 'MATERIAL_DISABLED' } });
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['upload delivery', { deliveryType: 'upload' }],
    ['released', { releasedAt: new Date() }],
    ['not ready', { status: 'Pending' }],
    ['no ready timestamp', { readyAt: null }],
    ['wrong purpose', { purpose: 'CourseCover' }],
    ['wrong mime', { mimeType: 'application/octet-stream' }],
    ['wrong file organization', { organizationId: '01900000-0000-7000-8000-00000000a002' }],
  ])('returns 409 for %s', async (_label, override) => {
    findFirst.mockResolvedValue({ ...fixture(), file: { ...fixture().file, ...override } });
    await expect(service.getMaterialSignedUrl(organizationId, courseId, materialId))
      .rejects.toMatchObject({ status: 409, response: { code: 'MATERIAL_FILE_NOT_READY' } });
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('returns 503 on StorageProviderError', async () => {
    getSignedUrl.mockImplementation(() => { throw new StorageProviderError('signing unavailable'); });
    await expect(service.getMaterialSignedUrl(organizationId, courseId, materialId))
      .rejects.toMatchObject({ status: 503, response: { code: 'MATERIAL_URL_UNAVAILABLE' } });
  });
});
