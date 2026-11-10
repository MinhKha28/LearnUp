import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpException, Logger } from '@nestjs/common';
import { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import { MaterialSigningError } from '../../src/infrastructure/clients/course/course-service.errors';
import { MaterialProgressService } from '../../src/modules/material-progress/material-progress.service';
import type { MaterialProgressRepository } from '../../src/modules/material-progress/material-progress.repository';
const id = '27200000-0000-4000-8000-000000000001';
const user = { userId: id, organizationId: id, role: 'LEARNER', isAuthenticated: true } as const;
const signed = { url: 'https://example.test/signed?signature=never-log', expiresAt: '2026-11-01T00:15:00.000Z', mimeType: 'video/mp4' };

test('Signing HTTP sends the version ID and internal context, validates data, never caches, and bounds timeout', async () => {
  let status = 200;
  let data: unknown = signed;
  let code = 'MATERIAL_NOT_FOUND';
  let calls = 0;
  let stall = false;
  const server = createServer(async (req, res) => {
    calls++;
    assert.equal(req.method, 'POST');
    assert.equal(req.url, `/api/v1/internal/materials/${id}/signed-url`);
    assert.equal(req.headers['x-internal-key'], 'isolated-signing-key');
    assert.equal(req.headers['x-organization-id'], id);
    assert.equal(req.headers['x-user-id'], id);
    assert.equal(req.headers['x-user-role'], 'LEARNER');
    let body = ''; for await (const chunk of req) body += chunk;
    assert.deepEqual(JSON.parse(body), { courseId: id });
    if (stall) return;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(status === 200 ? { data } : { error: { code } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const client = new CourseServiceClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, internalKey: 'isolated-signing-key', timeoutMs: 100 });
  try {
    assert.deepEqual(await client.getMaterialSignedUrl(user, id, id), signed);
    await client.getMaterialSignedUrl(user, id, id);
    assert.equal(calls, 2);
    for (data of [null, {}, { ...signed, url: 'http://example.test/a' }, { ...signed, url: 'https://user:secret@example.test' }, { ...signed, expiresAt: '2026-02-30T00:00:00.000Z' }, { ...signed, expiresAt: 'bad' }, { ...signed, mimeType: '' }])
      await assert.rejects(client.getMaterialSignedUrl(user, id, id), MaterialSigningError);
    for (const item of [[404, 'MATERIAL_NOT_FOUND'], [409, 'MATERIAL_DISABLED'], [409, 'MATERIAL_FILE_NOT_READY'], [503, 'MATERIAL_URL_UNAVAILABLE']] as const) {
      [status, code] = item;
      await assert.rejects(client.getMaterialSignedUrl(user, id, id), (error: unknown) => error instanceof MaterialSigningError && error.status === status);
    }
    stall = true;
    await assert.rejects(client.getMaterialSignedUrl(user, id, id), (error: unknown) => error instanceof MaterialSigningError && error.status === null);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  await assert.rejects(client.getMaterialSignedUrl(user, id, id), MaterialSigningError);
});

test('Video and Reading sign every request, map each error, and log only safe request facts', async () => {
  let kind: 'Video' | 'Reading' = 'Video';
  let failure: Error | null = null;
  let calls = 0;
  const repository = {
    access: async () => ({ id, courseId: id, status: 'NotStarted', disabledAt: null, videoCompletionPercent: 90 }),
    material: async () => ({ materialId: id, lessonId: id, materialType: kind, disabledAt: null, durationSeconds: 100 }),
    disabledLesson: async () => false,
    read: async () => ({ watchedRanges: [], watchedSeconds: 0, completedAt: null, positionSeconds: null, positionReportedAt: null }),
  };
  const client = {
    getCourseTree: async () => ({ disabledAt: null, modules: [{ lessons: [{ id, disabledAt: null, materials: [{ id, title: 'Content', disabledAt: null, materialType: kind }] }] }] }),
    getMaterialSignedUrl: async (_user: unknown, courseId: string, materialId: string) => {
      assert.equal(courseId, id); assert.equal(materialId, id); calls++;
      if (failure) throw failure;
      return { ...signed, mimeType: kind === 'Video' ? 'video/mp4' : 'application/pdf' };
    },
  };
  const service = new MaterialProgressService(repository as unknown as MaterialProgressRepository, client as unknown as CourseServiceClient);
  const original = Logger.prototype.error;
  const logs: unknown[] = [];
  Logger.prototype.error = (entry: unknown) => { logs.push(entry); };
  try {
    for (kind of ['Video', 'Reading'] as const) {
      const request = () => kind === 'Video' ? service.playback(user, id, id) : service.readingAccess(user, id, id);
      failure = null;
      await request(); await request();
      for (const [upstream, upstreamCode, expected, expectedCode] of [
        [404, 'MATERIAL_NOT_FOUND', 404, 'MATERIAL_NOT_FOUND'],
        [409, 'MATERIAL_DISABLED', 403, 'CONTENT_UNAVAILABLE'],
        [409, 'MATERIAL_FILE_NOT_READY', 409, 'MATERIAL_NOT_READY'],
        [503, null, 503, 'SERVICE_UNAVAILABLE'],
        [200, null, 503, 'SERVICE_UNAVAILABLE'],
        [null, null, 503, 'SERVICE_UNAVAILABLE'],
      ] as const) {
        failure = new MaterialSigningError(upstream, upstreamCode);
        const before = logs.length;
        await assert.rejects(request(), (error: unknown) => error instanceof HttpException && error.getStatus() === expected && (error.getResponse() as { code: string }).code === expectedCode);
        assert.equal(logs.length - before, upstreamCode === 'MATERIAL_DISABLED' ? 0 : 1);
        if (logs.length > before) assert.deepEqual(logs.at(-1), { message: 'Material signing failed', materialId: id, enrollmentId: id, courseStatus: upstream });
      }
    }
    assert.equal(calls, 16);
    assert.ok(!JSON.stringify(logs).includes(signed.url));
  } finally { Logger.prototype.error = original; }
});
