import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  BadRequestException,
  HttpException,
  type INestApplication,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CurrentUser } from '@learnup/ts-common';
import type { IReadableStorageProvider } from '@learnup/ts-storage';
import type { NextFunction, Request, Response } from 'express';
import { readFileSync } from 'node:fs';
import type { IncomingHttpHeaders, Server } from 'node:http';
import { type AddressInfo, connect } from 'node:net';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
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
import {
  READING_UPLOAD_DRAIN_MAX_BYTES,
  resolveReadingUploadAdmissionLimits,
} from './reading-upload-admission';

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

const debugSpy = jest
  .spyOn(Logger.prototype, 'debug')
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

const BUSY_BODY = {
  statusCode: 503,
  code: 'READING_PARSE_BUSY',
  message: 'Reading processing is busy. Retry later.',
  retryAfterSeconds: 10,
};

const busyFailure = () =>
  new extractor.ReadingTextExtractionError(
    'BUSY',
    'ParseQueueFull',
    'parse queue full',
  );

const abortedFailure = () =>
  new extractor.ReadingTextExtractionError(
    'ABORTED',
    'ClientAborted',
    'client disconnected',
  );

const debugLogs = () =>
  debugSpy.mock.calls
    .map(([message]) => String(message))
    .filter((message) => message.includes('READING_UPLOAD_ABORTED'));

describe('Reading parse queue full or client gone (service)', () => {
  const create = (bytes: Buffer, signal?: AbortSignal) =>
    service.uploadReadingMaterial(
      instructor,
      courseId,
      lessonId,
      { title: 'Reading', isRequired: false },
      asUpload(bytes),
      signal,
    );
  const replace = (bytes: Buffer, signal?: AbortSignal) =>
    service.replaceTechnicalFile(
      instructor,
      courseId,
      lessonId,
      materialId,
      asUpload(bytes),
      signal,
    );
  const expectNothingStored = () => {
    expect(storage.upload).not.toHaveBeenCalled();
    expect(repository.createReadingMaterialWithQuota).not.toHaveBeenCalled();
    expect(repository.commitTechnicalReplacement).not.toHaveBeenCalled();
  };

  it.each([
    ['create', create],
    ['replacement', replace],
  ] as const)(
    'answers 503 READING_PARSE_BUSY on %s when the parse queue is full',
    async (_path, run) => {
      extractSpy.mockRejectedValueOnce(busyFailure());

      const error = await run(fixture('chromium')).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toEqual(
        BUSY_BODY,
      );
      expectNothingStored();
      expect(parseFailureLogs()).toEqual([]);
    },
  );

  it.each([
    ['create', create],
    ['replacement', replace],
  ] as const)(
    'stops %s without storing when the client disconnects during the parse',
    async (_path, run) => {
      extractSpy.mockRejectedValueOnce(abortedFailure());

      const error = await run(fixture('chromium')).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(499);
      expectNothingStored();
      expect(parseFailureLogs()).toEqual([]);
      expect(debugLogs()).toHaveLength(1);
    },
  );

  it.each([
    ['create', create],
    ['replacement', replace],
  ] as const)(
    'stops %s before Cloudinary when the client disconnects right after the parse',
    async (_path, run) => {
      const client = new AbortController();

      extractSpy.mockImplementationOnce(() => {
        client.abort();
        return Promise.resolve({ wordCount: 4, extractionWarning: null });
      });

      await expect(run(fixture('chromium'), client.signal)).rejects.toThrow(
        'Client closed the request.',
      );
      expectNothingStored();
    },
  );

  it('passes the request abort signal to the extractor', async () => {
    const client = new AbortController();

    await create(fixture('chromium'), client.signal);

    expect(extractSpy.mock.calls[0][3]).toBe(client.signal);
  });
});

describe('Reading upload overload over HTTP', () => {
  let app: INestApplication;
  const overloadEnv = {
    // Một request tạo Reading đang xử lý là đầy; xả body tối đa 1 s, 1 kết nối.
    READING_UPLOAD_MAX_IN_FLIGHT: '1',
    READING_UPLOAD_DRAIN_TIMEOUT_MS: '1000',
    READING_UPLOAD_DRAIN_MAX_CONNECTIONS: '1',
  };
  const previous = Object.fromEntries(
    Object.keys(overloadEnv).map((name) => [name, process.env[name]]),
  );

  beforeAll(async () => {
    Object.assign(process.env, overloadEnv);

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
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();

    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
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

  // Giữ parse của request đầu cho tới khi test cho phép chạy tiếp. Test fail
  // vẫn nhả mọi parse đang giữ trong afterEach, nên afterAll không bị treo.
  const heldParses: Array<() => void> = [];

  afterEach(() => {
    for (const release of heldParses.splice(0)) release();
  });

  const holdNextParse = () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));

    extractSpy.mockImplementationOnce(async () => {
      await gate;
      return { wordCount: 4, extractionWarning: null };
    });
    heldParses.push(() => release());

    return () => release();
  };
  const parseStarted = async (count: number) => {
    for (let i = 0; i < 500 && extractSpy.mock.calls.length < count; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(extractSpy.mock.calls.length).toBe(count);
  };

  it('rejects a create beyond the in-flight limit with 503 and Retry-After before it reaches the service', async () => {
    const release = holdNextParse();
    const first = create(fixture('chromium')).then((response) => response);

    await parseStarted(1);
    const rejected = await create(fixture('vietnamese'));

    expect(rejected.status).toBe(503);
    expect(rejected.headers['retry-after']).toBe('10');
    expect((rejected.body as { error: unknown }).error).toEqual(BUSY_BODY);
    // Request bị từ chối chưa tới service: không tra cứu, không upload, không ghi DB.
    expect(repository.findLessonForMaterialUpload).toHaveBeenCalledTimes(1);

    release();
    expect((await first).status).toBe(201);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(repository.createReadingMaterialWithQuota).toHaveBeenCalledTimes(1);

    // Slot đã được trả: request tiếp theo được nhận.
    expect((await create(fixture('chromium'))).status).toBe(201);
  });

  it('releases the in-flight slot exactly once per request', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await create(fixture('chromium'))).status).toBe(201);
    }

    const release = holdNextParse();
    const held = create(fixture('chromium')).then((response) => response);

    await parseStarted(4);
    expect((await create(fixture('chromium'))).status).toBe(503);

    release();
    expect((await held).status).toBe(201);
  });

  it('frees the in-flight slot and stores nothing when the client disconnects', async () => {
    const release = holdNextParse();
    const aborted = create(fixture('chromium'));
    const settled = aborted.then(
      () => 'completed',
      () => 'aborted',
    );

    await parseStarted(1);
    const signal = extractSpy.mock.calls[0][3] as AbortSignal;

    aborted.abort();
    for (let i = 0; i < 500 && !signal.aborted; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(signal.aborted).toBe(true);
    await settled;

    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(storage.upload).not.toHaveBeenCalled();
    expect(repository.createReadingMaterialWithQuota).not.toHaveBeenCalled();
    expect(debugLogs()).toHaveLength(1);

    expect((await create(fixture('chromium'))).status).toBe(201);
  });

  it('answers 503 with Retry-After when the parse queue is full on replacement', async () => {
    extractSpy.mockRejectedValueOnce(busyFailure());

    const response = await replace(fixture('chromium'));

    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('10');
    expect((response.body as { error: unknown }).error).toEqual(BUSY_BODY);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(repository.commitTechnicalReplacement).not.toHaveBeenCalled();
  });

  it('keeps other errors without a Retry-After header', async () => {
    const response = await create(fixture('corrupt'));

    expect(response.status).toBe(400);
    expect(response.headers['retry-after']).toBeUndefined();
  });
  // Client HTTP thô: gửi body theo nhịp, ghi lại lúc nhận response và lúc
  // server đóng socket (không dùng supertest vì cần điều khiển việc gửi).
  interface RawUpload {
    status?: number;
    headers: IncomingHttpHeaders;
    body: string;
    sent: number;
    respondedAfterMs?: number;
    closedAfterMs: number;
    error?: string;
  }

  const rawUpload = (options: {
    total: number;
    everyMs?: number;
  }): Promise<RawUpload> =>
    new Promise((resolve) => {
      const chunk = 64 * 1024;
      const block = Buffer.alloc(chunk, 0x20);
      const started = Date.now();
      const result: RawUpload = {
        headers: {},
        body: '',
        sent: 0,
        closedAfterMs: 0,
      };
      const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
      // TCP thô: tự viết request HTTP/1.1 keep-alive như trình duyệt.
      const socket = connect(port, '127.0.0.1');
      let response = '';
      let timer: NodeJS.Timeout | undefined;
      let closed = false;

      socket.on('data', (data: Buffer) => {
        result.respondedAfterMs ??= Date.now() - started;
        response += data.toString('utf8');
      });
      socket.on('error', (error: NodeJS.ErrnoException) => {
        result.error = error.code;
      });
      socket.once('close', () => {
        closed = true;
        clearTimeout(timer);
        result.closedAfterMs = Date.now() - started;

        const [head = '', ...rest] = response.split('\r\n\r\n');
        const [statusLine = '', ...lines] = head.split('\r\n');
        const status = /^HTTP\/1\.1 (\d{3})/.exec(statusLine)?.[1];

        result.status = status ? Number(status) : undefined;
        for (const line of lines) {
          const index = line.indexOf(':');
          result.headers[line.slice(0, index).trim().toLowerCase()] = line
            .slice(index + 1)
            .trim();
        }
        result.body = rest.join('\r\n\r\n');
        resolve(result);
      });

      socket.write(
        `POST /courses/${courseId}/lessons/${lessonId}/materials/readings HTTP/1.1\r\n` +
          `Host: 127.0.0.1:${port}\r\nConnection: keep-alive\r\n` +
          'Content-Type: multipart/form-data; boundary=c29\r\n' +
          `Content-Length: ${options.total}\r\n\r\n`,
      );

      const pump = () => {
        while (!closed && result.sent < options.total) {
          const size = Math.min(chunk, options.total - result.sent);
          result.sent += size;
          const ok = socket.write(
            size === chunk ? block : block.subarray(0, size),
          );

          if (options.everyMs) {
            timer = setTimeout(pump, options.everyMs);
            return;
          }
          if (!ok) {
            socket.once('drain', pump);
            return;
          }
        }
      };

      pump();
    });

  // Giữ slot duy nhất bằng một request đang parse.
  const occupySlot = async () => {
    const release = holdNextParse();
    const held = create(fixture('chromium')).then((response) => response);

    await parseStarted(1);
    return async () => {
      release();
      expect((await held).status).toBe(201);
    };
  };

  it('answers 503 at once, keeps reading the body and closes the socket when it is complete', async () => {
    const free = await occupySlot();
    const result = await rawUpload({ total: 2 * 1024 * 1024, everyMs: 5 });

    expect(result.status).toBe(503);
    expect(result.headers['retry-after']).toBe('10');
    expect(result.headers.connection).not.toBe('close');
    expect(JSON.parse(result.body)).toMatchObject({ error: BUSY_BODY });
    // Response tới trước khi client gửi xong; socket đóng sau khi body xong.
    expect(result.respondedAfterMs!).toBeLessThan(result.closedAfterMs / 2);
    expect(result.sent).toBe(2 * 1024 * 1024);
    expect(result.error).toBeUndefined();
    expect(repository.findLessonForMaterialUpload).toHaveBeenCalledTimes(1);

    await free();
  });

  it('discards the drained body: memory does not grow with its size', async () => {
    // gc() để đo bộ nhớ còn giữ lại sau khi xả, không phụ thuộc thời điểm GC.
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc') as () => void;
    const retained = () => {
      gc();
      gc();
      const usage = process.memoryUsage();
      return usage.heapUsed + usage.arrayBuffers;
    };
    const free = await occupySlot();
    const before = retained();
    const result = await rawUpload({ total: 45 * 1024 * 1024 });
    const after = retained();

    expect(result.status).toBe(503);
    expect(result.sent).toBe(45 * 1024 * 1024);
    expect(after - before).toBeLessThan(8 * 1024 * 1024);

    await free();
  });

  it('closes the socket once the drained body passes the byte cap', async () => {
    const free = await occupySlot();
    const total = 80 * 1024 * 1024;
    const result = await rawUpload({ total });

    expect(result.status).toBe(503);
    expect(result.sent).toBeLessThan(total);
    expect(result.sent).toBeGreaterThan(READING_UPLOAD_DRAIN_MAX_BYTES);

    await free();
  });

  it('closes the socket of a body that never ends at the drain time limit', async () => {
    const free = await occupySlot();
    const result = await rawUpload({
      total: 40 * 1024 * 1024,
      everyMs: 50,
    });

    expect(result.status).toBe(503);
    expect(result.closedAfterMs).toBeGreaterThanOrEqual(900);
    expect(result.closedAfterMs).toBeLessThan(3_000);
    expect(result.sent).toBeLessThan(40 * 1024 * 1024);

    await free();
  });

  it('closes a rejected upload at once when the drain cap is reached', async () => {
    const free = await occupySlot();
    const draining = rawUpload({
      total: 40 * 1024 * 1024,
      everyMs: 50,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    const beyondCap = await rawUpload({
      total: 40 * 1024 * 1024,
      everyMs: 50,
    });

    // Kết nối thứ hai bị đóng ngay, trong khi kết nối đầu vẫn đang được xả.
    expect(beyondCap.closedAfterMs).toBeLessThan(500);
    expect(beyondCap.sent).toBeLessThan(2 * 1024 * 1024);

    const first = await draining;

    expect(first.closedAfterMs).toBeGreaterThanOrEqual(900);
    await free();
  });
});

describe('resolveReadingUploadAdmissionLimits', () => {
  it('uses the agreed defaults when the variables are unset or empty', () => {
    const expected = {
      maxInFlight: 6,
      drainTimeoutMs: 120_000,
      maxDrainingConnections: 20,
    };

    expect(resolveReadingUploadAdmissionLimits({})).toEqual(expected);
    expect(
      resolveReadingUploadAdmissionLimits({
        READING_UPLOAD_MAX_IN_FLIGHT: '',
        READING_UPLOAD_DRAIN_TIMEOUT_MS: '',
        READING_UPLOAD_DRAIN_MAX_CONNECTIONS: '',
      }),
    ).toEqual(expected);
    // 50 MiB của giới hạn tạo Reading + 1 MiB cho vỏ multipart.
    expect(READING_UPLOAD_DRAIN_MAX_BYTES).toBe(51 * 1024 * 1024);
  });

  it('accepts the lowest allowed values', () => {
    expect(
      resolveReadingUploadAdmissionLimits({
        READING_UPLOAD_MAX_IN_FLIGHT: '1',
        READING_UPLOAD_DRAIN_TIMEOUT_MS: '1000',
        READING_UPLOAD_DRAIN_MAX_CONNECTIONS: '0',
      }),
    ).toEqual({
      maxInFlight: 1,
      drainTimeoutMs: 1000,
      maxDrainingConnections: 0,
    });
  });

  it.each([
    ['READING_UPLOAD_MAX_IN_FLIGHT', '0', 1],
    ['READING_UPLOAD_DRAIN_TIMEOUT_MS', '999', 1000],
    ['READING_UPLOAD_DRAIN_MAX_CONNECTIONS', '-1', 0],
  ])('rejects %s=%s', (name, value, min) => {
    expect(() =>
      resolveReadingUploadAdmissionLimits({ [name]: value }),
    ).toThrow(`Invalid ${name}: expected a safe integer of at least ${min}.`);
  });
});
