import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, describe, test, mock } from 'node:test';
import type { AddressInfo } from 'node:net';
import { NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { EnrollmentsService } from '../../src/modules/enrollments/enrollments.service';

void describe('UC25.3 rate limit HTTP', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  before(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error'],
    });
    configureApp(app);
    const service = app.get(EnrollmentsService);
    mock.method(service, 'enrollOptional', async () => {
      throw new NotFoundException({
        code: 'COURSE_NOT_AVAILABLE',
        message: 'Course không còn trong danh mục',
      });
    });
    mock.method(service, 'findMyEnrollments', async () => ({
      items: [],
      total: 0,
    }));
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1/enrollments`;
  });
  after(async () => {
    await app?.close();
  });
  const headers = (userId: string) => ({
    'content-type': 'application/json',
    'x-internal-key': process.env.INTERNAL_SERVICE_KEY!,
    'x-user-id': userId,
    'x-organization-id': '0199a000-0000-7000-8000-0a00000000f2',
    'x-user-role': 'LEARNER',
  });
  const post = (userId: string) =>
    fetch(baseUrl, {
      method: 'POST',
      headers: headers(userId),
      body: JSON.stringify({
        courseId: '0199a000-0000-7000-8000-0e00000000f1',
      }),
    });
  void test('10 business failures count, request 11 is an enveloped 429, another user is isolated', async () => {
    const user = '0199a000-0000-7000-8000-0b000000ee01';
    for (let i = 0; i < 10; i++) {
      const response = await post(user);
      assert.equal(response.status, 404);
      await response.arrayBuffer();
    }
    const [blocked, other] = await Promise.all([
      post(user),
      post('0199a000-0000-7000-8000-0b000000ee02'),
    ]);
    assert.equal(blocked.status, 429);
    const body = await blocked.json();
    assert.equal(body.statusCode, 429);
    assert.equal(body.path, '/api/v1/enrollments');
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
    assert.equal(body.error.code, 'RATE_LIMITED');
    assert.equal(
      body.error.message,
      'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút',
    );
    assert.ok(Number.isInteger(body.error.retryAfterSeconds));
    assert.ok(
      body.error.retryAfterSeconds >= 1 && body.error.retryAfterSeconds <= 60,
    );
    assert.equal(
      blocked.headers.get('retry-after'),
      String(body.error.retryAfterSeconds),
    );
    assert.deepEqual(Object.keys(body.error).sort(), [
      'code',
      'message',
      'retryAfterSeconds',
    ]);
    assert.equal(other.status, 404);
    await other.arrayBuffer();
    for (let i = 0; i < 20; i++) {
      const response = await fetch(`${baseUrl}/me`, { headers: headers(user) });
      assert.equal(response.status, 200);
      await response.arrayBuffer();
    }
  });
  void test('missing authentication stays 401 and does not consume quota', async () => {
    const user = '0199a000-0000-7000-8000-0b000000ee03';
    for (let i = 0; i < 11; i++) {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { ...headers(user), 'x-internal-key': '' },
      });
      assert.equal(response.status, 401);
      await response.arrayBuffer();
    }
    const response = await post(user);
    assert.equal(response.status, 404);
    await response.arrayBuffer();
  });
});
