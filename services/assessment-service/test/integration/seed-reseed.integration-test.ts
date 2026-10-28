/**
 * The demo seeds on a database that was seeded with the old IDs (Organization A, Learner and Courses of 0199a000-…).
 * The seeds only write by fixed id, so a second run has to move the old rows to the new owners, never add a duplicate
 * or fail on a unique constraint. The old state is made by moving the rows of a first run back to the old IDs.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createTestDatabase, SERVICE_DIR, type TestDatabase } from './harness';

const OLD_ORG = '0199a000-0000-7000-8000-0a0000000001';
const OLD_LEARNER = '0199a000-0000-7000-8000-0b0000000001';
const OLD_COURSE = '0199a000-0000-7000-8000-0e0000000002';
const OLD_MODULE = '0199a000-0000-7000-8000-1a0000000011';
const ORG_ABC = '01900000-0000-7000-8000-00000000a001';
const LEARNER_ABC = '01900000-0000-7000-8000-00000000a201';
const NEW_COURSE = '01900000-0000-7000-8000-c0020000005c';

describe('the demo seeds on a database seeded with the old IDs', () => {
  let db: TestDatabase;

  /** Runs a seed and returns what it printed. */
  const seed = (file: string): string => {
    const result = spawnSync(
      'npx',
      ['ts-node', '-P', 'tsconfig.seed.json', file],
      {
        cwd: SERVICE_DIR,
        env: { ...process.env, DATABASE_URL: db.url },
        shell: true,
        encoding: 'utf8',
      },
    );
    const log = `${result.stdout}${result.stderr}`
      .split('\n')
      .filter((line) => !/^\s+at /.test(line))
      .join(' | ')
      .slice(0, 1500);
    assert.equal(result.status, 0, `${file} failed: ${log}`);
    return result.stdout;
  };
  const count = async (sql: string) =>
    ((await db.query(sql)) as { n: number }[])[0].n;
  const seedAll = () => {
    seed('prisma/seed.ts');
    seed('prisma/seed-quizzes.ts');
  };

  before(async () => {
    db = await createTestDatabase();
  });
  after(async () => {
    await db?.drop();
  });

  test('a first run on an empty database puts the demo under Organization ABC, the Learner a201 and the Courses of the course seed', async () => {
    seedAll();
    assert.equal(
      await count(
        `SELECT count(*)::int AS n FROM assessments WHERE course_id = '${NEW_COURSE}' AND organization_id = '${ORG_ABC}'`,
      ),
      3, // the Assignment, the required Quiz and the optional Quiz
    );
    assert.ok(
      (await count(
        `SELECT count(*)::int AS n FROM learner_assessment_states WHERE learner_id = '${LEARNER_ABC}'`,
      )) >= 1,
      'the demo Learner state belongs to the Learner a201',
    );
  });

  test('the Course it names for trying to create an Assignment is a Draft that the course seed creates, and has none', async () => {
    // course-service/prisma/seed.ts: the Course version id is fixtureId(0xc002, chain * 10 + version)
    const courseSeed = readFileSync(
      join(SERVICE_DIR, '..', 'course-service', 'prisma', 'seed.ts'),
      'utf8',
    );
    const draft = courseSeed.match(
      /code:'DRAFT_EMPTY',chain:(\d+),version:(\d+),[^}]*?status:STATUS\.DRAFT/,
    );
    assert.ok(draft, 'the course seed still has the Draft DRAFT_EMPTY');
    const expected = `01900000-0000-7000-8000-c002${(Number(draft[1]) * 10 + Number(draft[2])).toString(16).padStart(8, '0')}`;

    const printed = seed('prisma/seed.ts');
    const named = printed.match(
      /Course không có Assignment \(thử tạo mới\): ([0-9a-f-]{36})/,
    );
    assert.ok(named, 'the seed says which Course has no Assignment');
    assert.equal(named[1], expected, 'it is a Draft Course of the course seed');
    assert.equal(
      await count(
        `SELECT count(*)::int AS n FROM assessments WHERE course_id = '${named[1]}'`,
      ),
      0,
      'and it has no Assignment, so a new one can be tried',
    );
  });

  test('the same data written under the old IDs, then seeded again: the rows move, nothing is added and nothing fails', async () => {
    // Make the database look like one seeded before this change.
    await db.query(
      `UPDATE assessments SET organization_id = '${OLD_ORG}', course_id = '${OLD_COURSE}' WHERE course_id = '${NEW_COURSE}'`,
    );
    await db.query(
      `UPDATE learner_assessment_states SET organization_id = '${OLD_ORG}', learner_id = '${OLD_LEARNER}' WHERE learner_id = '${LEARNER_ABC}'`,
    );
    await db.query(
      `UPDATE submissions SET organization_id = '${OLD_ORG}', learner_id = '${OLD_LEARNER}' WHERE learner_id = '${LEARNER_ABC}'`,
    );
    await db.query(
      `UPDATE assessments SET module_id = '${OLD_MODULE}' WHERE module_id = '01900000-0000-7000-8000-c00300000399'`,
    );
    const before = {
      assessments: await count('SELECT count(*)::int AS n FROM assessments'),
      states: await count(
        'SELECT count(*)::int AS n FROM learner_assessment_states',
      ),
      submissions: await count('SELECT count(*)::int AS n FROM submissions'),
      attempts: await count('SELECT count(*)::int AS n FROM quiz_attempts'),
    };
    assert.ok(
      (await count(
        `SELECT count(*)::int AS n FROM assessments WHERE organization_id = '${OLD_ORG}'`,
      )) > 0,
      'the database should hold rows of the old Organization A before the second run',
    );

    seedAll();

    assert.deepEqual(
      {
        assessments: await count('SELECT count(*)::int AS n FROM assessments'),
        states: await count(
          'SELECT count(*)::int AS n FROM learner_assessment_states',
        ),
        submissions: await count('SELECT count(*)::int AS n FROM submissions'),
        attempts: await count('SELECT count(*)::int AS n FROM quiz_attempts'),
      },
      before,
      'no duplicate row',
    );
    for (const table of [
      'assessments',
      'learner_assessment_states',
      'submissions',
    ]) {
      assert.equal(
        await count(
          `SELECT count(*)::int AS n FROM ${table} WHERE organization_id = '${OLD_ORG}'`,
        ),
        0,
        `${table} still has rows of the old Organization A`,
      );
    }
    assert.equal(
      await count(
        `SELECT count(*)::int AS n FROM learner_assessment_states WHERE learner_id = '${OLD_LEARNER}'`,
      ),
      0,
    );
    assert.equal(
      await count(
        `SELECT count(*)::int AS n FROM assessments WHERE course_id = '${NEW_COURSE}' AND organization_id = '${ORG_ABC}'`,
      ),
      3,
    );
  });

  test('a run right after that changes nothing (still safe to repeat)', async () => {
    const state = () =>
      count(
        `SELECT (SELECT count(*) FROM assessments) + (SELECT count(*) FROM submissions) + (SELECT count(*) FROM learner_assessment_states) + (SELECT count(*) FROM quiz_questions) AS n`,
      );
    const first = await state();
    seedAll();
    assert.equal(await state(), first);
  });
});
