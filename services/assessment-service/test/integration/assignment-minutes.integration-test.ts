/**
 * BR-51 / BR-172 through the real HTTP API, a real Postgres and a Course Service stub: every create, duration change
 * and delete tells the Course the total minutes of all its Assignments, and a Course Service that is down does not
 * stop the Instructor. The tests are one story and share state.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  startCourseStub,
  startService,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

describe('Assignment minutes reach the Course', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let first: string;
  let second: string;

  const make = (title: string, expectedDurationMinutes: number) =>
    api('POST', '/assignments', {
      courseId: COURSE,
      title,
      prompt: 'Write it',
      passingScore: 70,
      expectedDurationMinutes,
      rubric: [{ name: 'A', description: 'A desc', maxPoints: 10 }],
    });
  const outbox = async () =>
    (await db.query(
      `SELECT payload->>'change' AS change, published_at IS NOT NULL AS done
       FROM outbox_events WHERE event_type = 'AssignmentMinutesChanged' ORDER BY created_at, id`,
    )) as { change: string; done: boolean }[];

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    service = await startService(db.url, { COURSE_SERVICE_URL: course.url });
    api = apiFor(service.baseUrl);
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    await db?.drop();
  });

  test('each create tells the Course the total of all its Assignments', async () => {
    const a = await make('First', 30);
    assert.equal(a.status, 201, JSON.stringify(a.json));
    first = a.data.id;
    const b = await make('Second', 60);
    assert.equal(b.status, 201, JSON.stringify(b.json));
    second = b.data.id;
    assert.deepEqual(course.minutes, [30, 90]);
    assert.deepEqual(await outbox(), [
      { change: 'Created', done: true },
      { change: 'Created', done: true },
    ]);
  });

  test('a new duration is sent as the new total, a change of the title alone is not', async () => {
    const same = await api('PATCH', `/assignments/${first}`, {
      title: 'First, renamed',
    });
    assert.equal(same.status, 200, JSON.stringify(same.json));
    assert.deepEqual(course.minutes, [30, 90]);

    const longer = await api('PATCH', `/assignments/${first}`, {
      expectedDurationMinutes: 45,
    });
    assert.equal(longer.status, 200, JSON.stringify(longer.json));
    assert.deepEqual(course.minutes, [30, 90, 105]);
  });

  test('a Locked Course still takes a new duration (BR-173)', async () => {
    course.state.locked = true;
    const r = await api('PATCH', `/assignments/${second}`, {
      expectedDurationMinutes: 20,
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(course.minutes, [30, 90, 105, 65]);
    course.state.locked = false;
  });

  test('deleting tells the Course the total without the Assignment', async () => {
    const r = await api('DELETE', `/assignments/${second}`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(course.minutes, [30, 90, 105, 65, 45]);
  });

  test('a Course Service that is down does not stop the Instructor; the next call makes it right', async () => {
    course.failMinutes.value = true;
    const created = await make('While it is down', 15);
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const rows = await outbox();
    assert.equal(rows[rows.length - 1].done, false, 'the row waits');
    assert.deepEqual(course.minutes, [30, 90, 105, 65, 45]);

    course.failMinutes.value = false;
    const next = await make('When it is back', 10);
    assert.equal(next.status, 201, JSON.stringify(next.json));
    // the total is absolute: 45 (First) + 15 + 10, so nothing that was missed is lost
    assert.equal(course.minutes[course.minutes.length - 1], 70);
  });
});
