import { InternalMaterialsController } from './internal-materials.controller';
import type { InternalCoursesService } from './internal-courses.service';

describe('InternalMaterialsController', () => {
  it('forwards correct context to Signed URL service', async () => {
    const getMaterialSignedUrl = jest.fn().mockResolvedValue({
      url: 'https://example.test/signed',
      expiresAt: '2026-10-30T12:00:00.000Z',
      mimeType: 'application/pdf',
    });
    const controller = new InternalMaterialsController({
      getMaterialSignedUrl,
    } as unknown as InternalCoursesService);
    const response = await controller.signedUrl(
      '01900000-0000-7000-8000-00000000a001',
      '01a17e2a-3c38-7743-94df-355529578f67',
      { courseId: '01900000-0000-7000-8000-c0020000008d' },
    );
    expect(getMaterialSignedUrl).toHaveBeenCalledWith(
      '01900000-0000-7000-8000-00000000a001',
      '01900000-0000-7000-8000-c0020000008d',
      '01a17e2a-3c38-7743-94df-355529578f67',
    );
    expect(response.mimeType).toBe('application/pdf');
  });
});
