import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  BadRequestException,
  type INestApplication,
  Logger,
  PayloadTooLargeException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CurrentUser } from '@learnup/ts-common';
import type { IReadableStorageProvider } from '@learnup/ts-storage';
import type { NextFunction, Request, Response } from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import type { AssessmentClient } from '@infra/clients/assessment/assessment.client';
import type { LearningClient } from '@infra/clients/learning/learning.client';
import type { NotificationClient } from '@infra/clients/notification/notification.client';
import type { TenantClient } from '@infra/clients/tenant/tenant.client';
import { CoursesController } from './courses.controller';
import type { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';
import * as extractor from './reading-text-extractor';

jest.setTimeout(60_000);

const organizationId = '01900000-0000-7000-8000-00000000a001';
const instructorId = '01900000-0000-7000-8000-00000000a011';
const courseId = '01900000-0000-7000-8000-00000000c001';
const lessonId = '01900000-0000-7000-8000-00000000c004';
const materialId = '01900000-0000-7000-8000-00000000c005';
const instructor: CurrentUser = {
  organizationId,
  userId: instructorId,
  role: 'INSTRUCTOR',
  isAuthenticated: true,
};

const CREATE_UNREADABLE =
  'Unable to read PDF. The file may be corrupted or password-protected.';
const REPLACE_UNREADABLE = 'Unable to read replacement PDF.';
const BR_293_WARNING =
  'No readable text was extracted from this document. Estimated reading time will be 0 minutes (BR-293).';

const fixture = (name: string) =>
  readFileSync(
    join(__dirname, '../../../test/fixtures/reading-pdf', `${name}.pdf`),
  );

const mockAsync = () => jest.fn<(...args: any[]) => Promise<any>>();
const repository = {
  findLessonForMaterialUpload: mockAsync(),
  getReadingSettings: mockAsync(),
  getOrganizationStoredBytes: mockAsync(),
  createReadingMaterialWithQuota: mockAsync(),
  findMaterialForUpdate: mockAsync(),
  commitTechnicalReplacement: mockAsync(),
};
const tenant = { getInstructorMaterialUploadPolicy: mockAsync() };
const storage = { upload: mockAsync(), delete: mockAsync() };
const service = new CoursesService(
  repository as unknown as CoursesRepository,
  tenant as unknown as TenantClient,
  {} as LearningClient,
  {} as AssessmentClient,
  {} as NotificationClient,
  storage as unknown as IReadableStorageProvider,
);

const extractSpy = jest.spyOn(extractor, 'extractReadingText');
const warnSpy = jest
  .spyOn(Logger.prototype, 'warn')
  .mockImplementation(() => undefined);

const parseFailureLogs = () =>
  warnSpy.mock.calls
    .map(([message]) => String(message))
    .filter((message) => message.includes('READING_PDF_PARSE_FAILED'));

const asUpload = (bytes: Buffer): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'reading.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: bytes.length,
    buffer: bytes,
  }) as Express.Multer.File;

const uploadedBytes = () =>
  (storage.upload.mock.calls[0][0] as { buffer: Buffer }).buffer;

beforeEach(() => {
  jest.clearAllMocks();

  repository.findLessonForMaterialUpload.mockResolvedValue({
    id: lessonId,
    title: 'Lesson',
    disabledAt: null,
    module: {
      course: {
        id: courseId,
        name: 'Course',
        status: 'Draft',
        lockedAt: null,
        disabledAt: null,
        deletedAt: null,
      },
    },
  });
  repository.getReadingSettings.mockResolvedValue({
    maxReadingSizeBytes: BigInt(50 * 1024 * 1024),
    allowedReadingMimeTypes: ['application/pdf'],
    readingSpeedWordsPerMinute: 200,
  });
  repository.getOrganizationStoredBytes.mockResolvedValue(0n);
  repository.createReadingMaterialWithQuota.mockImplementation(
    (data: { file: { wordCount: number } }) =>
      Promise.resolve({
        status: 'CREATED',
        material: { id: materialId, wordCount: data.file.wordCount },
      }),
  );
  repository.findMaterialForUpdate.mockResolvedValue({
    id: materialId,
    fileId: 'file-old',
    materialType: 'Reading',
    file: {
      status: 'Ready',
      releasedAt: null,
      sizeBytes: 100n,
      storageKey: 'old-key',
    },
    lesson: {
      disabledAt: null,
      module: {
        course: {
          status: 'Draft',
          disabledAt: null,
          deletedAt: null,
        },
      },
    },
  });
  repository.commitTechnicalReplacement.mockImplementation(
    (data: { replacement: { sizeBytes: number; wordCount: number } }) =>
      Promise.resolve({
        status: 'REPLACED',
        fileId: 'file-new',
        storageKey: 'new-key',
        sizeBytes: String(data.replacement.sizeBytes),
        durationSeconds: null,
        wordCount: data.replacement.wordCount,
        oldFile: {
          storageKey: 'old-key',
          resourceType: 'raw',
          deliveryType: 'authenticated',
        },
      }),
  );
  tenant.getInstructorMaterialUploadPolicy.mockResolvedValue({
    canUpload: true,
    maxStorageBytes: 1024 * 1024 * 1024,
  });
  storage.upload.mockImplementation((file: { sizeBytes: number }) =>
    Promise.resolve({
      storageKey: 'new-key',
      resourceType: 'raw',
      deliveryType: 'authenticated',
      sizeBytes: file.sizeBytes,
      format: 'pdf',
    }),
  );
  storage.delete.mockResolvedValue(undefined);
});

describe('UC17.2 Reading upload parses the PDF', () => {
  const upload = (bytes: Buffer) =>
    service.uploadReadingMaterial(
      instructor,
      courseId,
      lessonId,
      { title: 'Reading', isRequired: false },
      asUpload(bytes),
    );

  it('stores the Vietnamese word count and uploads the unchanged bytes', async () => {
    const bytes = fixture('vietnamese');
    const original = Buffer.from(bytes);

    await expect(upload(bytes)).resolves.toMatchObject({
      wordCount: 9,
      extractionWarning: null,
    });
    expect(
      repository.createReadingMaterialWithQuota.mock.calls[0][0],
    ).toMatchObject({ file: { wordCount: 9 } });
    expect(uploadedBytes().equals(original)).toBe(true);
    expect(bytes.equals(original)).toBe(true);
  });

  it('accepts an image-only PDF with the BR-293 warning and zero words', async () => {
    await expect(upload(fixture('image-only'))).resolves.toMatchObject({
      wordCount: 0,
      extractionWarning: BR_293_WARNING,
    });
    expect(
      repository.createReadingMaterialWithQuota.mock.calls[0][0],
    ).toMatchObject({ file: { wordCount: 0 } });
  });

  it.each(['corrupt', 'password-protected'])(
    'returns the existing 400 for the %s fixture without uploading',
    async (name) => {
      const error = await upload(fixture(name)).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(CREATE_UNREADABLE);
      expect(storage.upload).not.toHaveBeenCalled();
    },
  );

  it('returns the existing 400 when the parse worker fails', async () => {
    extractSpy.mockRejectedValueOnce(
      new extractor.ReadingTextExtractionError(
        'TIMEOUT',
        'Deadline',
        'exceeded 1 ms',
      ),
    );

    await expect(upload(fixture('chromium'))).rejects.toThrow(
      CREATE_UNREADABLE,
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects an oversize Reading with 413 before parsing', async () => {
    repository.getReadingSettings.mockResolvedValue({
      maxReadingSizeBytes: 1000n,
      allowedReadingMimeTypes: ['application/pdf'],
      readingSpeedWordsPerMinute: 200,
    });

    await expect(upload(fixture('chromium'))).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(extractSpy).not.toHaveBeenCalled();
  });
});

describe('UC17.3 technical replacement parses the PDF', () => {
  const replace = (bytes: Buffer) =>
    service.replaceTechnicalFile(
      instructor,
      courseId,
      lessonId,
      materialId,
      asUpload(bytes),
    );

  it('commits the Vietnamese word count and uploads the unchanged bytes', async () => {
    const bytes = fixture('vietnamese');
    const original = Buffer.from(bytes);

    await expect(replace(bytes)).resolves.toMatchObject({
      wordCount: 9,
      extractionWarning: null,
    });
    expect(
      repository.commitTechnicalReplacement.mock.calls[0][0],
    ).toMatchObject({ replacement: { wordCount: 9 } });
    expect(uploadedBytes().equals(original)).toBe(true);
    expect(bytes.equals(original)).toBe(true);
  });

  it('accepts an image-only replacement with the BR-293 warning and zero words', async () => {
    await expect(replace(fixture('image-only'))).resolves.toMatchObject({
      wordCount: 0,
      extractionWarning: BR_293_WARNING,
    });
  });

  it.each(['corrupt', 'password-protected'])(
    'returns the existing 400 for the %s fixture without uploading',
    async (name) => {
      const error = await replace(fixture(name)).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(REPLACE_UNREADABLE);
      expect(storage.upload).not.toHaveBeenCalled();
    },
  );

  it('returns the existing 400 when the parse worker fails', async () => {
    extractSpy.mockRejectedValueOnce(
      new extractor.ReadingTextExtractionError(
        'WORKER_FAILED',
        'ERR_WORKER_OUT_OF_MEMORY',
        'crashed',
      ),
    );

    await expect(replace(fixture('chromium'))).rejects.toThrow(
      REPLACE_UNREADABLE,
    );
  });

  it('returns 413 FILE_TOO_LARGE before starting the parser', async () => {
    repository.getReadingSettings.mockResolvedValue({
      maxReadingSizeBytes: 1000n,
      allowedReadingMimeTypes: ['application/pdf'],
      readingSpeedWordsPerMinute: 200,
    });

    const error = await replace(fixture('chromium')).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PayloadTooLargeException);
    expect((error as PayloadTooLargeException).getResponse()).toEqual({
      statusCode: 413,
      code: 'FILE_TOO_LARGE',
      message: 'Replacement exceeds the allowed size.',
    });
    expect(extractSpy).not.toHaveBeenCalled();
    expect(tenant.getInstructorMaterialUploadPolicy).not.toHaveBeenCalled();
  });
});

describe('Reading upload HTTP contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: CurrentUser }).user = instructor;
      next();
    });
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (path: string, bytes: Buffer, withFields: boolean) => {
    const call = request(app.getHttpServer() as Parameters<typeof request>[0])
      .post(`/courses/${courseId}/lessons/${lessonId}/materials/${path}`)
      .attach('file', bytes, {
        filename: 'reading.pdf',
        contentType: 'application/pdf',
      });

    return withFields
      ? call.field('title', 'Reading').field('isRequired', 'false')
      : call;
  };
  const create = (bytes: Buffer) => post('readings', bytes, true);
  const replace = (bytes: Buffer) =>
    post(`${materialId}/technical-replacement`, bytes, false);

  it('creates a Reading from a pooled Multer buffer with the Vietnamese word count', async () => {
    const bytes = fixture('vietnamese');
    const response = await create(bytes);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      wordCount: 9,
      extractionWarning: null,
    });
    expect(uploadedBytes().equals(bytes)).toBe(true);
  });

  it('creates an image-only Reading with the BR-293 warning', async () => {
    const response = await create(fixture('image-only'));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      wordCount: 0,
      extractionWarning: BR_293_WARNING,
    });
  });

  it.each(['corrupt', 'password-protected'])(
    'answers 400 with the exact create message for the %s fixture',
    async (name) => {
      const response = await create(fixture(name));

      expect(response.status).toBe(400);
      expect((response.body as { error: unknown }).error).toMatchObject({
        statusCode: 400,
        message: CREATE_UNREADABLE,
      });
    },
  );

  it('replaces a Reading from a pooled Multer buffer with the Vietnamese word count', async () => {
    const bytes = fixture('vietnamese');
    const response = await replace(bytes);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      wordCount: 9,
      extractionWarning: null,
    });
    expect(uploadedBytes().equals(bytes)).toBe(true);
  });

  it.each(['corrupt', 'password-protected'])(
    'answers 400 with the exact replacement message for the %s fixture',
    async (name) => {
      const response = await replace(fixture(name));

      expect(response.status).toBe(400);
      expect((response.body as { error: unknown }).error).toMatchObject({
        statusCode: 400,
        message: REPLACE_UNREADABLE,
      });
    },
  );

  it('answers 413 FILE_TOO_LARGE on replacement without parsing', async () => {
    repository.getReadingSettings.mockResolvedValue({
      maxReadingSizeBytes: 1000n,
      allowedReadingMimeTypes: ['application/pdf'],
      readingSpeedWordsPerMinute: 200,
    });

    const response = await replace(fixture('chromium'));

    expect(response.status).toBe(413);
    expect((response.body as { error: unknown }).error).toEqual({
      statusCode: 413,
      code: 'FILE_TOO_LARGE',
      message: 'Replacement exceeds the allowed size.',
    });
    expect(extractSpy).not.toHaveBeenCalled();
  });
});

describe('Reading parse failure logging', () => {
  it('logs the parser error class with the create ids, without file content', async () => {
    await service
      .uploadReadingMaterial(
        instructor,
        courseId,
        lessonId,
        { title: 'Reading', isRequired: false },
        asUpload(fixture('password-protected')),
      )
      .catch(() => undefined);

    const logs = parseFailureLogs();

    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0])).toEqual({
      action: 'READING_PDF_PARSE_FAILED',
      path: 'create',
      organizationId,
      actorId: instructorId,
      courseId,
      lessonId,
      reason: 'UNREADABLE',
      errorClass: 'PasswordException',
    });
    expect(logs[0]).not.toMatch(/%PDF|password protected fixture/i);
  });

  it('logs the corrupt PDF class with the replacement material id', async () => {
    await service
      .replaceTechnicalFile(
        instructor,
        courseId,
        lessonId,
        materialId,
        asUpload(fixture('corrupt')),
      )
      .catch(() => undefined);

    expect(JSON.parse(parseFailureLogs()[0])).toEqual({
      action: 'READING_PDF_PARSE_FAILED',
      path: 'replacement',
      organizationId,
      actorId: instructorId,
      courseId,
      lessonId,
      materialId,
      reason: 'UNREADABLE',
      errorClass: 'InvalidPDFException',
    });
  });

  it.each([
    ['TIMEOUT', 'Deadline'],
    ['WORKER_FAILED', 'ERR_WORKER_OUT_OF_MEMORY'],
    ['WORKER_FAILED', 'WorkerExit'],
  ] as const)('logs %s (%s) at warn level', async (reason, errorClass) => {
    extractSpy.mockRejectedValueOnce(
      new extractor.ReadingTextExtractionError(reason, errorClass, 'detail'),
    );

    await expect(
      service.replaceTechnicalFile(
        instructor,
        courseId,
        lessonId,
        materialId,
        asUpload(fixture('chromium')),
      ),
    ).rejects.toThrow(REPLACE_UNREADABLE);
    expect(JSON.parse(parseFailureLogs()[0])).toMatchObject({
      materialId,
      reason,
      errorClass,
    });
  });
});

describe('Reading parse limits at startup', () => {
  const create = () =>
    new CoursesService(
      repository as unknown as CoursesRepository,
      tenant as unknown as TenantClient,
      {} as LearningClient,
      {} as AssessmentClient,
      {} as NotificationClient,
      storage as unknown as IReadableStorageProvider,
    );

  it.each([
    ['READING_PDF_PARSE_TIMEOUT_MS', '999'],
    ['READING_PDF_PARSE_MAX_OLD_GENERATION_MB', '31'],
    ['READING_PDF_PARSE_MAX_CONCURRENCY', '0'],
  ])('refuses to construct the service with %s=%s', (name, value) => {
    const previous = process.env[name];
    process.env[name] = value;

    try {
      expect(create).toThrow(`Invalid ${name}`);
    } finally {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    }
  });
});
