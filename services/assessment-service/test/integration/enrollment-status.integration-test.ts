/**
 * BR-169 through the real HTTP API, a real Postgres and a Learning Service stub that answers the status of the
 * Enrollment: Completed makes the Assignment read-only (UC29, UC30, UC30.1), any other status leaves it open, and
 * an answer without a status falls back to the table of Completed Enrollments. The tests are one story.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  KEY,
  LEARNER,
  ORG,
  startCourseStub,
  startService,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const ENROLLMENT = '00000000-0000-4000-8000-0000000000e1';
const as = identity({ user: LEARNER, role: 'LEARNER' });

describe('the Enrollment status decides BR-169', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let learning: Server;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;
  let assignmentId: string;
  /** What Learning Service says about the Enrollment: undefined = no status in its answer. */
  let status: string | undefined = 'InProgress';
  /** The calls Learning Service received about the learning activity. */
  const activity: { enrollmentId: string; occurredAt: string }[] = [];
  let activityAnswer = 200;

  const view = async () =>
    (await api('GET', `/learner/assignments/${assignmentId}`, undefined, as))
      .data;
  const send = async (kind: 'submissions' | 'resubmissions') => {
    const form = new FormData();
    form.append('content', 'my work');
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignmentId}/${kind}`,
      { method: 'POST', headers: as, body: form },
    );
    const json = (await response.json().catch(() => ({}))) as {
      error?: { code?: string };
    };
    return { status: response.status, code: json.error?.code };
  };
  const readOnlyInList = async () =>
    (await api('GET', `/learner/courses/${COURSE}/assessments`, undefined, as))
      .data.readOnly;

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    learning = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      if (req.headers['x-internal-key'] !== KEY) {
        res.statusCode = 401;
        return res.end('{}');
      }
      if (req.method === 'POST' && req.url?.endsWith('/learning-activity')) {
        let raw = '';
        req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
        req.on('end', () => {
          res.statusCode = activityAnswer;
          if (activityAnswer === 200) {
            activity.push({
              enrollmentId: req.url!.split('/')[5],
              occurredAt: (JSON.parse(raw) as { occurredAt: string }).occurredAt,
            });
          }
          res.end('{}');
        });
        return;
      }
      res.end(
        JSON.stringify({
          statusCode: 200,
          message: 'ok',
          data: [
            {
              courseId: COURSE,
              enrollmentId: ENROLLMENT,
              ...(status === undefined ? {} : { status }),
            },
          ],
        }),
      );
    });
    await new Promise<void>((resolve) => learning.listen(0, resolve));
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      LEARNING_SERVICE_URL: `http://127.0.0.1:${(learning.address() as AddressInfo).port}`,
    });
    api = apiFor(service.baseUrl);
    const created = await api('POST', '/assignments', {
      courseId: COURSE,
      title: 'Essay',
      prompt: 'Write it',
      passingScore: 70,
      expectedDurationMinutes: 30,
      maxConsecutiveAttempts: 50, // the lock of BR-176 is not what is tried here
      rubric: [{ name: 'A', description: 'a', maxPoints: 10 }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    assignmentId = created.data.id;
  });
  after(async () => {
    await service?.stop();
    await course?.stop();
    learning?.closeAllConnections();
    learning?.close();
    await db?.drop();
  });

  test('an Enrollment that is InProgress can submit and resubmit', async () => {
    status = 'InProgress';
    assert.equal((await send('submissions')).status, 201);
    assert.equal((await send('resubmissions')).status, 201);
    assert.equal((await view()).readOnly, false);
    assert.equal(await readOnlyInList(), false);
  });

  test('once Learning Service says Completed, everything is read-only (409 ENROLLMENT_COMPLETED)', async () => {
    status = 'Completed';
    const submit = await send('submissions');
    assert.equal(submit.status, 409);
    assert.equal(submit.code, 'ENROLLMENT_COMPLETED');
    const again = await send('resubmissions');
    assert.equal(again.status, 409);
    assert.equal(again.code, 'ENROLLMENT_COMPLETED');
    assert.equal((await view()).readOnly, true);
    assert.equal(await readOnlyInList(), true);
  });

  test('the answer is read at every request: back to InProgress opens it again', async () => {
    status = 'InProgress';
    assert.equal((await send('resubmissions')).status, 201);
    assert.equal((await view()).readOnly, false);
  });

  test('without a status the table of Completed Enrollments decides (an older Learning Service)', async () => {
    status = undefined;
    assert.equal((await send('resubmissions')).status, 201); // not in the table
    await db.query(
      `INSERT INTO completed_enrollments (enrollment_id, organization_id, learner_id, course_id, completed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now(), now())`,
      [ENROLLMENT, ORG, LEARNER, COURSE],
    );
    const blocked = await send('resubmissions');
    assert.equal(blocked.status, 409);
    assert.equal(blocked.code, 'ENROLLMENT_COMPLETED');
    assert.equal((await view()).readOnly, true);
  });

  test('a status wins over the table: InProgress is open even when the table says Completed', async () => {
    status = 'InProgress';
    assert.equal((await send('resubmissions')).status, 201);
    assert.equal((await view()).readOnly, false);
  });

  describe('the first activity starts the Enrollment (BR-119)', () => {
    test('a submission tells Learning Service, once, with the Enrollment and the time of the submission', async () => {
      status = undefined; // an older Learning Service: no status in its answer
      activity.length = 0;
      await db.query(
        'DELETE FROM completed_enrollments WHERE enrollment_id = $1',
        [ENROLLMENT],
      );
      const r = await send('resubmissions');
      assert.equal(r.status, 201);
      assert.equal(activity.length, 1);
      assert.equal(activity[0].enrollmentId, ENROLLMENT);
      const [{ submitted }] = (await db.query(
        'SELECT submitted_at AS submitted FROM submissions ORDER BY created_at DESC LIMIT 1',
      )) as { submitted: Date }[];
      assert.equal(
        new Date(activity[0].occurredAt).getTime(),
        new Date(submitted).getTime(),
      );
    });

    test('with a status that says the Enrollment has started, nothing is sent', async () => {
      status = 'InProgress';
      activity.length = 0;
      assert.equal((await send('resubmissions')).status, 201);
      assert.equal(activity.length, 0);
      status = 'NotStarted';
      assert.equal((await send('resubmissions')).status, 201);
      assert.equal(activity.length, 1);
    });

    test('a Learning Service that refuses does not stop the Learner, and the work is saved', async () => {
      status = undefined;
      activityAnswer = 500;
      const before = Number(
        (await db.query('SELECT count(*) AS n FROM submissions'))[0].n,
      );
      const r = await send('resubmissions');
      assert.equal(r.status, 201);
      assert.equal(
        Number((await db.query('SELECT count(*) AS n FROM submissions'))[0].n),
        before + 1,
      );
      activityAnswer = 200;
    });
  });
});
