import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { TenantClient } from '../src/infrastructure/clients/tenant/tenant.client';
import { LearningClient } from '../src/infrastructure/clients/learning/learning.client';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing Course integration tests in production.');

describe('Course values (HTTP and real database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const organizationId = '0199a000-1710-7000-8000-0a00000000f1';
  const instructorId = randomUUID();
  const headers = {
    'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
    'x-organization-id': organizationId,
    'x-user-id': instructorId,
    'x-user-role': 'INSTRUCTOR',
  };
  const payload = {
    name: 'An toàn lao động',
    expectedCompletionDays: 14,
    courseType: 'Public',
  };
  const clean = () =>
    prisma.courseChain.deleteMany({ where: { organizationId } });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TenantClient)
      .useValue({
        getInstructors: async () => [
          { id: instructorId, fullName: 'Giảng viên kiểm thử' },
        ],
      })
      .overrideProvider(LearningClient)
      .useValue({ getCourseLearnerCounts: async () => [] })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await clean();
  });

  afterEach(async () => {
    await clean();
  });
  afterAll(async () => {
    if (prisma) await clean();
    if (app) await app.close();
  });

  it.each(['Public', 'Private'])(
    'creates a %s Course with Draft stored in the database',
    async (courseType) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set(headers)
        .send({ ...payload, courseType })
        .expect(201);
      expect(response.body.status).toBe('Draft');
      const row = await prisma.course.findFirstOrThrow({
        where: { id: response.body.id, organizationId },
      });
      expect(row.status).toBe('Draft');
      expect(row.courseType).toBe(courseType);
    },
  );

  it.each(['PUBLIC', 'PRIVATE'])(
    'rejects uppercase create courseType %s',
    async (courseType) => {
      await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set(headers)
        .send({ ...payload, courseType })
        .expect(400);
      expect(await prisma.course.count({ where: { organizationId } })).toBe(0);
    },
  );

  it.each(['/courses', '/courses/organization'])(
    'rejects uppercase filters at %s',
    async (path) => {
      const role = path.endsWith('organization') ? 'ORGANIZER' : 'INSTRUCTOR';
      for (const status of [
        'DRAFT',
        'SUBMITTED',
        'PUBLISHED',
        'REJECTED',
        'ARCHIVED',
        'DISABLED',
      ]) {
        await request(app.getHttpServer())
          .get(`/api/v1${path}`)
          .set({ ...headers, 'x-user-role': role })
          .query({ status })
          .expect(400);
      }
      for (const courseType of ['PUBLIC', 'PRIVATE']) {
        await request(app.getHttpServer())
          .get(`/api/v1${path}`)
          .set({ ...headers, 'x-user-role': role })
          .query({ courseType })
          .expect(400);
      }
    },
  );

  it('filters Published Private Courses for Organizer and Instructor unchanged', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set(headers)
      .send({ ...payload, courseType: 'Private' })
      .expect(201);
    await prisma.course.updateMany({
      where: { id: created.body.id, organizationId },
      data: { status: 'Published' },
    });
    for (const [path, role] of [
      ['/courses', 'INSTRUCTOR'],
      ['/courses/organization', 'ORGANIZER'],
    ]) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set({ ...headers, 'x-user-role': role })
        .query({ status: 'Published', courseType: 'Private' })
        .expect(200);
      expect(response.body.result).toHaveLength(1);
      expect(response.body.result[0]).toMatchObject({
        id: created.body.id,
        status: 'Published',
        courseType: 'Private',
      });
    }
  });
});
