import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CompleteReadingPipe } from '../../src/modules/material-progress/complete-reading.pipe';
import { MaterialProgressService } from '../../src/modules/material-progress/material-progress.service';
import type { MaterialProgressRepository } from '../../src/modules/material-progress/material-progress.repository';
import type { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import { Logger, HttpException } from '@nestjs/common';

test('Reading accepts no business payload, including unknown keys', () => {
  const pipe = new CompleteReadingPipe();
  for (const body of [undefined, {}])
    assert.equal(pipe.transform(body), undefined);
  for (const body of [
    null,
    [],
    { completed: false },
    { extra: true },
    'x',
    1,
  ]) {
    assert.throws(
      () => pipe.transform(body),
      (e: unknown) =>
        e instanceof HttpException &&
        e.getStatus() === 422 &&
        (e.getResponse() as { code: string }).code === 'VALIDATION_ERROR',
    );
  }
});
test('Unknown stored status fails closed with a fixed diagnostic for Video and Reading', async () => {
  const id = '27030000-0000-4000-8000-000000000001';
  const repository = {
    access: async () => ({ status: 'Unexpected' }),
    transaction: async (f: (tx: unknown) => unknown) => f({}),
  };
  const service = new MaterialProgressService(
    repository as unknown as MaterialProgressRepository,
    {} as CourseServiceClient,
  );
  const user = {
    userId: id,
    organizationId: id,
    role: 'LEARNER',
    isAuthenticated: true,
  } as const;
  const original = Logger.prototype.error;
  const diagnostics: unknown[] = [];
  Logger.prototype.error = (message: unknown) => {
    diagnostics.push(message);
  };
  try {
    for (const action of [
      () => service.playback(user, id, id),
      () => service.completeReading(user, id, id),
    ])
      await assert.rejects(
        action,
        (e: unknown) => e instanceof HttpException && e.getStatus() === 500,
      );
    assert.deepEqual(diagnostics, [
      'INVALID_ENROLLMENT_STATUS',
      'INVALID_ENROLLMENT_STATUS',
    ]);
  } finally {
    Logger.prototype.error = original;
  }
});
