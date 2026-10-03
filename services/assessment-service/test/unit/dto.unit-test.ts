/** Request validation, run the way main.ts configures the ValidationPipe (whitelist + forbidNonWhitelisted). */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAssignmentDto } from '../../src/modules/assessments/dto/create-assignment.dto';
import { UpdateAssignmentDto } from '../../src/modules/assessments/dto/update-assignment.dto';
import { UpdatePeerReviewDto } from '../../src/modules/peer-review/dto/update-peer-review.dto';

async function problems(
  Dto: new () => object,
  input: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(Dto, input), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

const create = {
  courseId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
  title: 'T',
  prompt: 'p',
  passingScore: 70,
  expectedDurationMinutes: 60,
  rubric: [{ name: 'a', description: 'd', maxPoints: 10 }],
};

describe('CreateAssignmentDto', () => {
  test('a complete request is valid', async () => {
    assert.deepEqual(await problems(CreateAssignmentDto, create), []);
  });

  test('the Rubric is mandatory and every criterion needs a positive whole score (BR-164, BR-315)', async () => {
    assert.deepEqual(
      await problems(CreateAssignmentDto, { ...create, rubric: [] }),
      ['rubric'],
    );
    const bad = [
      { name: 'a', description: 'd', maxPoints: 0 },
      { name: 'a', description: 'd', maxPoints: -3 },
      { name: 'a', description: 'd', maxPoints: 2.5 },
      { name: 'a', description: 'd', maxPoints: 1001 },
      { name: '', description: 'd', maxPoints: 5 },
      { name: 'a', description: '', maxPoints: 5 },
    ];
    for (const criterion of bad) {
      assert.deepEqual(
        await problems(CreateAssignmentDto, { ...create, rubric: [criterion] }),
        ['rubric'],
        JSON.stringify(criterion),
      );
    }
  });

  test('the passing score is 0 to 100 with at most 2 decimals (BR-315)', async () => {
    for (const passingScore of [0, 70.5, 100]) {
      assert.deepEqual(
        await problems(CreateAssignmentDto, { ...create, passingScore }),
        [],
      );
    }
    for (const passingScore of [-1, 100.01, 101, 70.123, 'abc']) {
      assert.deepEqual(
        await problems(CreateAssignmentDto, { ...create, passingScore }),
        ['passingScore'],
        String(passingScore),
      );
    }
  });

  test('the effort is a whole number of minutes, at least 1 (BR-174)', async () => {
    for (const expectedDurationMinutes of [0, 1.5, -5]) {
      assert.deepEqual(
        await problems(CreateAssignmentDto, {
          ...create,
          expectedDurationMinutes,
        }),
        ['expectedDurationMinutes'],
      );
    }
  });

  test('n and m are optional but must be whole numbers of at least 1 (BR-175)', async () => {
    assert.deepEqual(
      await problems(CreateAssignmentDto, {
        ...create,
        maxConsecutiveAttempts: 3,
        lockoutHours: 24,
      }),
      [],
    );
    assert.deepEqual(
      await problems(CreateAssignmentDto, {
        ...create,
        maxConsecutiveAttempts: 0,
      }),
      ['maxConsecutiveAttempts'],
    );
    assert.deepEqual(
      await problems(CreateAssignmentDto, { ...create, lockoutHours: 1.5 }),
      ['lockoutHours'],
    );
  });

  test('Assignments are never optional, have no deadline and no Peer Review at creation (BR-165, BR-166)', async () => {
    for (const extra of [
      { isRequired: false },
      { dueDate: '2026-12-31' },
      { peerReviewEnabled: true },
    ]) {
      assert.deepEqual(
        await problems(CreateAssignmentDto, { ...create, ...extra }),
        [Object.keys(extra)[0]],
      );
    }
  });

  test('the Course must be a UUID and the title is bounded', async () => {
    assert.deepEqual(
      await problems(CreateAssignmentDto, {
        ...create,
        courseId: 'workplace-safety',
      }),
      ['courseId'],
    );
    assert.deepEqual(
      await problems(CreateAssignmentDto, {
        ...create,
        title: 'x'.repeat(201),
      }),
      ['title'],
    );
  });
});

describe('UpdateAssignmentDto', () => {
  test('every field is optional, so an empty patch is valid', async () => {
    assert.deepEqual(await problems(UpdateAssignmentDto, {}), []);
  });

  test('the Course cannot be changed', async () => {
    assert.deepEqual(
      await problems(UpdateAssignmentDto, { courseId: create.courseId }),
      ['courseId'],
    );
  });

  test('a supplied Rubric still has to be valid; the prompt file can be removed with null', async () => {
    assert.deepEqual(await problems(UpdateAssignmentDto, { rubric: [] }), [
      'rubric',
    ]);
    assert.deepEqual(
      await problems(UpdateAssignmentDto, { promptFile: null }),
      [],
    );
    assert.deepEqual(
      await problems(UpdateAssignmentDto, { passingScore: 101 }),
      ['passingScore'],
    );
  });
});

describe('UpdatePeerReviewDto', () => {
  test('turned off, nothing else is needed (BR-182)', async () => {
    assert.deepEqual(
      await problems(UpdatePeerReviewDto, { enabled: false }),
      [],
    );
  });

  test('turned on, the reviewer count and the score gap are required (BR-183)', async () => {
    assert.deepEqual(
      await problems(UpdatePeerReviewDto, { enabled: true, scoreGap: 20 }),
      ['reviewersPerSubmission'],
    );
    assert.deepEqual(
      await problems(UpdatePeerReviewDto, {
        enabled: true,
        reviewersPerSubmission: 2,
      }),
      ['scoreGap'],
    );
    assert.deepEqual(
      await problems(UpdatePeerReviewDto, {
        enabled: true,
        reviewersPerSubmission: 2,
        scoreGap: 20,
      }),
      [],
    );
  });

  test('numbers are whole and in range (BR-321: the gap is on the 0-100 scale)', async () => {
    const on = { enabled: true, reviewersPerSubmission: 2, scoreGap: 20 };
    assert.deepEqual(
      await problems(UpdatePeerReviewDto, { ...on, reviewersPerSubmission: 0 }),
      ['reviewersPerSubmission'],
    );
    assert.deepEqual(
      await problems(UpdatePeerReviewDto, { ...on, scoreGap: 101 }),
      ['scoreGap'],
    );
    assert.deepEqual(
      await problems(UpdatePeerReviewDto, { ...on, cycleDays: 0 }),
      ['cycleDays'],
    );
    assert.deepEqual(
      await problems(UpdatePeerReviewDto, { ...on, deadlineDays: 2.5 }),
      ['deadlineDays'],
    );
  });
});
