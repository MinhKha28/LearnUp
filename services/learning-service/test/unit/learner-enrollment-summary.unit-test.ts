import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { LearnerEnrollmentSummaryDto } from '../../src/modules/enrollments/dto/learner-enrollment-summary.dto';

for (const [label, learnerIds] of [
  ['empty', []],
  ['over 100', Array.from({ length: 101 }, () => randomUUID())],
  ['duplicate', Array(2).fill('0199a000-0013-7000-8000-0b0000000001')],
  ['invalid UUID', ['invalid']],
  [
    'duplicate UUID with different casing',
    [
      '0199a000-0013-7000-8000-0b0000000001',
      '0199A000-0013-7000-8000-0B0000000001',
    ],
  ],
] as const) {
  test(`UC13 body ${label} returns 400`, async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await assert.rejects(
      pipe.transform(
        { learnerIds },
        { type: 'body', metatype: LearnerEnrollmentSummaryDto },
      ),
      (error: { getStatus(): number }) => error.getStatus() === 400,
    );
  });
}

test('UC13 accepts 100 distinct UUIDs', async () => {
  const body = { learnerIds: Array.from({ length: 100 }, () => randomUUID()) };
  const result = await new ValidationPipe({ transform: true }).transform(body, {
    type: 'body',
    metatype: LearnerEnrollmentSummaryDto,
  });
  assert.deepEqual(result.learnerIds, body.learnerIds);
});
