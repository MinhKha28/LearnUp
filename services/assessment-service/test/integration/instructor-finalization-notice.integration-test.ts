/** Transactional finalization notices replace the former REST side effect. */
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
  sleep,
  startCourseStub,
  startService,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

interface Sent {
  path: string;
  status: number;
  body: Record<string, unknown>;
  hasInternalKey: boolean;
  hasUserId: boolean;
}

describe('BR-254 finalized notice events', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let notifier: Server;
  let api: ReturnType<typeof apiFor>;
  let sent: Sent[] = [];
  let notifierStatus = 201;
  let notifierUrl = '';
  async function createSubmission(title: string) {
    const created = await api('POST', '/assignments', {
      courseId: COURSE,
      title,
      prompt: 'Write an essay.',
      passingScore: 70,
      expectedDurationMinutes: 30,
      rubric: [
        { name: 'Content', description: 'Main argument', maxPoints: 100 },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const assignmentId = created.data.id as string;
    const [{ id: criterionId }] = await db.query(
      'SELECT id FROM rubric_criteria WHERE assessment_id = $1',
      [assignmentId],
    );
    const form = new FormData();
    form.set('content', 'My work');
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignmentId}/submissions`,
      {
        method: 'POST',
        headers: identity({ user: LEARNER, role: 'LEARNER' }),
        body: form,
      },
    );
    const json = (await response.json()) as { data: { id: string } };
    assert.equal(response.status, 201, JSON.stringify(json));
    return { assignmentId, submissionId: json.data.id, criterionId };
  }

  async function grade(submissionId: string, criterionId: string, points = 80) {
    const result = await api(
      'POST',
      `/submissions/${submissionId}/instructor-review`,
      { scores: [{ criterionId, points }], comment: 'Clear argument.' },
    );
    assert.equal(result.status, 201, JSON.stringify(result.json));
  }

  const finalize = (id: string, body: Record<string, unknown>) =>
    api('POST', `/submissions/${id}/finalize`, body);

  const gradedSubmission = async (title: string) => {
    const made = await createSubmission(title);
    await grade(made.submissionId, made.criterionId as string, 80);
    return made;
  };

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    notifier = createServer((request, response) => {
      let raw = '';
      request.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      request.on('end', () => {
        const path = request.url ?? '';
        const status = notifierStatus;
        sent.push({
          path,
          status,
          body: JSON.parse(raw) as Record<string, unknown>,
          hasInternalKey: request.headers['x-internal-key'] === KEY,
          hasUserId: request.headers['x-user-id'] !== undefined,
        });
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end('{}');
      });
    });
    await new Promise<void>((resolve) => notifier.listen(0, resolve));
    notifierUrl = `http://127.0.0.1:${(notifier.address() as AddressInfo).port}`;
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
      TENANT_CLIENT_MODE: 'fake',
      OUTBOX_RELAY_ENABLED: 'false',
      NOTIFICATION_CLIENT_MODE: 'http',
      NOTIFICATION_SERVICE_URL: notifierUrl,
    });
    api = apiFor(service.baseUrl);
  });

  after(async () => {
    await service?.stop();
    await new Promise<void>((resolve) => {
      if (notifier) notifier.close(() => resolve());
      else resolve();
    });
    await course?.stop();
    await db?.drop();
  });

  const notices = (submissionId: string) =>
    db.query(
      "SELECT * FROM outbox_events WHERE event_type = 'SubmissionFinalized' AND payload->>'submissionId' = $1",
      [submissionId],
    );
  test('finalization commits one exact notice and never calls notification REST; repeated finalize emits nothing', async () => {
    const { assignmentId, submissionId } =
      await gradedSubmission('Final assignment');
    sent = [];
    const result = await finalize(submissionId, { finalScore: 80 });
    assert.equal(result.status, 200);
    const rows = await notices(submissionId);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].payload, {
      learnerId: LEARNER,
      submissionId,
      assessmentId: assignmentId,
      assessmentTitle: 'Final assignment',
      finalScore: '80.00',
      maxScore: '100.00',
      courseId: COURSE,
      finalizedAt: result.data.finalizedAt,
    });
    assert.equal(
      (rows[0].occurred_at as Date).toISOString(),
      result.data.finalizedAt,
    );
    assert.equal(rows[0].organization_id, ORG);
    assert.equal(
      (await finalize(submissionId, { finalScore: 80 })).status,
      409,
    );
    assert.equal((await notices(submissionId)).length, 1);
    await sleep(100);
    assert.equal(sent.length, 0);
  });
  test('a finalized resubmission gets a second notice with a new event id', async () => {
    const { assignmentId, submissionId, criterionId } =
      await gradedSubmission('Resubmission');
    assert.equal(
      (await finalize(submissionId, { finalScore: 80 })).status,
      200,
    );
    const form = new FormData();
    form.set('content', 'Replacement work');
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignmentId}/resubmissions`,
      {
        method: 'POST',
        headers: identity({ user: LEARNER, role: 'LEARNER' }),
        body: form,
      },
    );
    assert.equal(response.status, 201);
    const json = (await response.json()) as { data: { id: string } };
    await grade(json.data.id, criterionId as string);
    assert.equal(
      (await finalize(json.data.id, { finalScore: 80 })).status,
      200,
    );
    const first = await notices(submissionId);
    const second = await notices(json.data.id);
    assert.equal(first.length, 1);
    assert.equal(second.length, 1);
    assert.notEqual(first[0].id, second[0].id);
  });
  test('a rejected finalization never writes a notice', async () => {
    const { submissionId } = await createSubmission('Not graded');
    assert.equal(
      (await finalize(submissionId, { finalScore: 80 })).status,
      409,
    );
    assert.equal((await notices(submissionId)).length, 0);
  });
  test('a failed notice insert rolls back finalization and the completion signal', async () => {
    const { submissionId } = await gradedSubmission('Rollback');
    await db.query(
      `CREATE FUNCTION reject_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type = 'SubmissionFinalized' THEN RAISE EXCEPTION 'notice rejected'; END IF; RETURN NEW; END; $$; CREATE TRIGGER reject_notice BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_notice();`,
    );
    try {
      assert.equal(
        (await finalize(submissionId, { finalScore: 80 })).status,
        500,
      );
      const [row] = await db.query(
        'SELECT grading_status, finalized_at FROM submissions WHERE id = $1',
        [submissionId],
      );
      assert.equal(row.grading_status, 'AwaitingFinalization');
      assert.equal(row.finalized_at, null);
      assert.equal(
        (
          await db.query(
            "SELECT id FROM outbox_events WHERE payload->>'submissionId' = $1 AND (event_type = 'SubmissionFinalized' OR payload->>'reason' = 'ASSIGNMENT_FINALIZED')",
            [submissionId],
          )
        ).length,
        0,
      );
    } finally {
      await db.query(
        'DROP TRIGGER reject_notice ON outbox_events; DROP FUNCTION reject_notice()',
      );
    }
  });
});
