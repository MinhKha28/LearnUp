import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { InternalAuthGuard } from '../src/common/guards/internal-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { InternalCoursesController } from '../src/modules/internal-courses/internal-courses.controller';
import { InternalCoursesService } from '../src/modules/internal-courses/internal-courses.service';

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing database tests in production.');

describe('ServiceCall batch (HTTP with real PostgreSQL)', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  const org = randomUUID();
  const otherOrg = randomUUID();
  const chain = randomUUID();
  const otherChain = randomUUID();
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const headers = {
    'x-internal-key': 'isolated-course-batch-test-key',
    'x-organization-id': org,
  };
  const endpoint = '/api/v1/internal/courses/batch';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InternalCoursesController],
      providers: [
        InternalCoursesService,
        PrismaService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            DATABASE_URL: process.env.DATABASE_URL,
            INTERNAL_SERVICE_KEY: headers['x-internal-key'],
          }),
        },
        { provide: APP_GUARD, useClass: InternalAuthGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.courseChain.createMany({
      data: [
        { id: chain, organizationId: org, instructorId: randomUUID() },
        {
          id: otherChain,
          organizationId: otherOrg,
          instructorId: randomUUID(),
        },
      ],
    });
    await prisma.course.createMany({
      data: ids.map((id, n) => ({
        id,
        organizationId: n === 2 ? otherOrg : org,
        chainId: n === 2 ? otherChain : chain,
        versionNumber: n + 1,
        name: `Snapshot course ${n}`,
        learningOutcomes: [],
        expectedCompletionDays: 14,
        courseType: 'Public',
        status: n === 0 ? 'Archived' : n === 1 ? 'Disabled' : 'Published',
        disabledAt: n === 1 ? new Date() : null,
      })),
    });
  });

  afterAll(async () => {
    try {
      if (prisma)
        await prisma.courseChain.deleteMany({
          where: {
            id: { in: [chain, otherChain] },
            organizationId: { in: [org, otherOrg] },
          },
        });
    } finally {
      if (app) await app.close();
    }
  });

  it('returns Archived and Disabled versions, omits foreign and unknown IDs, and preserves input order', async () => {
    const response = await request(app.getHttpServer())
      .post(endpoint)
      .set(headers)
      .send({ courseIds: [ids[1], ids[2], randomUUID(), ids[0]] })
      .expect(200);
    expect(response.body).toEqual({
      statusCode: 200,
      message: 'Courses fetched successfully',
      data: [
        {
          courseId: ids[1],
          chainId: chain,
          versionNumber: 2,
          name: 'Snapshot course 1',
          courseType: 'Public',
          status: 'Disabled',
          coverFileId: null,
        },
        {
          courseId: ids[0],
          chainId: chain,
          versionNumber: 1,
          name: 'Snapshot course 0',
          courseType: 'Public',
          status: 'Archived',
          coverFileId: null,
        },
      ],
    });
  });
  it('keeps the existing Learning call with user headers at 200 and the same response', async () => {
    const body = { courseIds: [ids[0]] };
    const service = await request(app.getHttpServer())
      .post(endpoint)
      .set(headers)
      .send(body)
      .expect(200);
    const learning = await request(app.getHttpServer())
      .post(endpoint)
      .set({ ...headers, 'x-user-id': randomUUID(), 'x-user-role': 'LEARNER' })
      .send(body)
      .expect(200);
    expect(learning.body).toEqual(service.body);
  });
  it.each(['', 'wrong'])(
    'rejects missing/incorrect key with a code (%s)',
    async (key) => {
      const response = await request(app.getHttpServer())
        .post(endpoint)
        .set({ ...headers, 'x-internal-key': key })
        .send({ courseIds: [ids[0]] })
        .expect(401);
      expect(response.body).toMatchObject({
        error: { code: 'INVALID_INTERNAL_KEY' },
      });
    },
  );
  it.each(['', 'invalid'])(
    'rejects missing/invalid organization (%s)',
    async (organizationId) => {
      const response = await request(app.getHttpServer())
        .post(endpoint)
        .set({ ...headers, 'x-organization-id': organizationId })
        .send({ courseIds: [ids[0]] })
        .expect(400);
      expect(response.body).toMatchObject({
        error: { code: 'ORGANIZATION_REQUIRED' },
      });
    },
  );
  it('rejects organizationId in the body', async () => {
    await request(app.getHttpServer())
      .post(endpoint)
      .set(headers)
      .send({ courseIds: [ids[0]], organizationId: otherOrg })
      .expect(400);
  });
  it('does not enable ServiceCall on another method in the same controller', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/internal/courses/${ids[0]}/tree`)
      .set(headers)
      .expect(401);
  });
});
