import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { InternalAuthGuard } from '@common/guards/internal-auth.guard';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { PrismaService } from '@infra/prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import { InternalCoursesService } from './internal-courses.service';
import { InternalOrganizationsController } from './internal-organizations.controller';

// UC44.1 - tenant-service hỏi mức dùng Course/dung lượng của một tổ chức thay Admin nền tảng.
// Internal key là lớp bảo vệ; header tổ chức chỉ phải trùng :organizationId.
const KEY = 'platform-usage-spec-internal-key-0123456789';

describe('UC44.1 GET /internal/platform/organizations/:organizationId/usage', () => {
  let app: INestApplication<Server>;
  let base: string;
  const courseChainCount = jest.fn();
  const mediaAggregate = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InternalOrganizationsController],
      providers: [
        InternalCoursesService,
        {
          provide: PrismaService,
          useValue: {
            courseChain: { count: courseChainCount },
            mediaFile: { aggregate: mediaAggregate },
          },
        },
        { provide: STORAGE_PROVIDER, useValue: {} },
        {
          provide: ConfigService,
          useValue: new ConfigService({ INTERNAL_SERVICE_KEY: KEY }),
        },
        { provide: APP_GUARD, useClass: InternalAuthGuard },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
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
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${port}/api/v1/internal/platform/organizations`;
  });

  afterAll(() => app.close());

  beforeEach(() => {
    courseChainCount.mockReset().mockResolvedValue(3);
    mediaAggregate
      .mockReset()
      .mockResolvedValue({ _sum: { sizeBytes: 2048n } });
  });

  const get = (organizationId: string, headers: Record<string, string>) =>
    fetch(`${base}/${organizationId}/usage`, { headers });

  it('returns the usage when the key is right and the header matches the path', async () => {
    const org = randomUUID();
    const response = await get(org, {
      'x-internal-key': KEY,
      'x-organization-id': org,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: unknown };
    expect(body.data).toEqual({
      organizationId: org,
      courseChains: 3,
      storageBytes: '2048',
    });
    expect(courseChainCount).toHaveBeenCalledWith({
      where: { organizationId: org, courses: { some: {} } },
    });
  });

  it('answers 404 and counts nothing when the header and the path differ', async () => {
    const response = await get(randomUUID(), {
      'x-internal-key': KEY,
      'x-organization-id': randomUUID(),
    });
    expect(response.status).toBe(404);
    expect(courseChainCount).not.toHaveBeenCalled();
    expect(mediaAggregate).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing internal key', {}],
    ['a wrong internal key', { 'x-internal-key': `${KEY.slice(0, -1)}X` }],
  ])('answers 401 for %s', async (_name, keyHeader: Record<string, string>) => {
    const org = randomUUID();
    const response = await get(org, { ...keyHeader, 'x-organization-id': org });
    expect(response.status).toBe(401);
    expect(courseChainCount).not.toHaveBeenCalled();
  });

  it('answers 400 without the organization header', async () => {
    const response = await get(randomUUID(), { 'x-internal-key': KEY });
    expect(response.status).toBe(400);
    expect(courseChainCount).not.toHaveBeenCalled();
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const response = await get('not-a-uuid', {
      'x-internal-key': KEY,
      'x-organization-id': randomUUID(),
    });
    expect(response.status).toBe(400);
  });
});
