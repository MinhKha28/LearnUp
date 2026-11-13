/**
 * BR-254 / UC32.3: when the Instructor publishes the final score, the Learner is told by the bell and by e-mail.
 * The real HttpNotificationClient talks to a stub of notification-service, so the paths, the headers and the bodies
 * are the ones notification-service would receive. The notice is a side effect: it never undoes the score.
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

interface Sent {
  path: string;
  body: Record<string, unknown>;
  hasInternalKey: boolean;
  hasUserId: boolean;
}

describe('BR-254 the Learner is told when the final score is published', () => {
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
        sent.push({
          path: request.url ?? '',
          body: JSON.parse(raw) as Record<string, unknown>,
          hasInternalKey: request.headers['x-internal-key'] === KEY,
          hasUserId: request.headers['x-user-id'] !== undefined,
        });
        response.writeHead(notifierStatus, {
          'content-type': 'application/json',
        });
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

  test('the bell and the e-mail go to the Learner of the submission, in Vietnamese and as plain text', async () => {
    const { assignmentId, submissionId } = await gradedSubmission(
      'Final <b>exercise</b>',
    );
    sent = [];
    const result = await finalize(submissionId, { finalScore: 80 });
    assert.equal(result.status, 200, JSON.stringify(result.json));

    assert.equal(sent.length, 2, JSON.stringify(sent));
    const bell = sent.find((s) => s.path.endsWith('/notifications/send'));
    assert.ok(bell, JSON.stringify(sent));
    assert.equal(bell.body.recipientUserId, LEARNER);
    assert.equal(bell.body.organizationId, ORG);
    assert.equal(bell.body.title, 'Điểm bài tập đã được công bố');
    assert.match(String(bell.body.message), /"Final <b>exercise<\/b>"/);
    assert.match(String(bell.body.message), /Điểm cuối cùng của bạn là 80%\./);
    // notification-service keeps the metadata as text, so the client sends it as a JSON string
    assert.deepEqual(JSON.parse(String(bell.body.metadata)), {
      assignmentId,
      courseId: COURSE,
    });
    assert.equal(bell.hasInternalKey, true);
    assert.equal(bell.hasUserId, false);

    const mail = sent.find((s) => s.path.endsWith('/notifications/email/send'));
    assert.ok(mail, JSON.stringify(sent));
    assert.match(String(mail.body.recipientEmail), /@demo\.local$/);
    assert.equal(mail.body.subject, 'Điểm bài tập đã được công bố');
    assert.equal(mail.body.templateCode, 'ASSIGNMENT_FINALIZED');
    assert.match(String(mail.body.body), /^Xin chào /);
    // plain text: a title with angle brackets must not turn the whole mail into HTML
    assert.equal(/[<>]/.test(String(mail.body.body)), false);
    assert.equal(mail.hasInternalKey, true);
  });

  test('the score reads with the Vietnamese decimal comma', async () => {
    const { submissionId } = await gradedSubmission('Decimal exercise');
    sent = [];
    const result = await finalize(submissionId, {
      finalScore: 79.5,
      comment: 'Adjusted for the presentation.',
    });
    assert.equal(result.status, 200, JSON.stringify(result.json));
    const bell = sent.find((s) => s.path.endsWith('/notifications/send'));
    assert.ok(bell, JSON.stringify(sent));
    assert.match(String(bell.body.message), /là 79,5%\./);
  });

  test('a refused finalization sends nothing', async () => {
    const { submissionId } = await gradedSubmission('Refused exercise');
    // not awaiting finalization yet, then finalized twice
    const ungraded = await createSubmission('Not graded yet');
    sent = [];
    const early = await finalize(ungraded.submissionId, { finalScore: 80 });
    assert.equal(early.status, 409, JSON.stringify(early.json));

    const first = await finalize(submissionId, { finalScore: 80 });
    assert.equal(first.status, 200, JSON.stringify(first.json));
    const afterFirst = sent.length;
    assert.equal(afterFirst, 2, JSON.stringify(sent));

    const again = await finalize(submissionId, { finalScore: 80 });
    assert.equal(again.status, 409, JSON.stringify(again.json));
    assert.equal(again.code, 'SUBMISSION_ALREADY_FINALIZED');
    assert.equal(sent.length, afterFirst, 'the repeated request tells nobody');
  });

  test('the score stays published when notification-service refuses both messages', async () => {
    const { submissionId } = await gradedSubmission('Notifier down');
    sent = [];
    notifierStatus = 500;
    try {
      const result = await finalize(submissionId, { finalScore: 80 });
      assert.equal(result.status, 200, JSON.stringify(result.json));
      assert.equal(result.data.gradingStatus, 'Finalized');
    } finally {
      notifierStatus = 201;
    }
    assert.equal(sent.length, 2, 'both channels were tried, each on its own');
    const [row] = await db.query(
      'SELECT grading_status, final_score FROM submissions WHERE id = $1',
      [submissionId],
    );
    assert.equal(row.grading_status, 'Finalized');
    assert.equal(Number(row.final_score), 80);
    const events = await db.query(
      `SELECT 1 FROM outbox_events WHERE payload->>'submissionId' = $1
         AND payload->>'reason' = 'ASSIGNMENT_FINALIZED'`,
      [submissionId],
    );
    assert.equal(events.length, 1, 'the event for Learning is still written');
  });

  test('a Kafka that cannot be reached stops neither the service nor the finalization nor its notice', async () => {
    const { submissionId } = await gradedSubmission('Kafka is down');
    // The relay is on and the only broker is a closed port: the service must start and work all the same.
    const down = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
      TENANT_CLIENT_MODE: 'fake',
      OUTBOX_RELAY_ENABLED: 'true',
      KAFKA_BROKERS: '127.0.0.1:1',
      OUTBOX_PROBE_TIMEOUT_MS: '200',
      OUTBOX_DELIVERY_TIMEOUT_MS: '1000', // the first probe of an unreachable broker ends in about a second
      NOTIFICATION_CLIENT_MODE: 'http',
      NOTIFICATION_SERVICE_URL: notifierUrl,
    });
    try {
      sent = [];
      const result = await apiFor(down.baseUrl)(
        'POST',
        `/submissions/${submissionId}/finalize`,
        { finalScore: 80 },
      );
      assert.equal(result.status, 200, JSON.stringify(result.json));
      assert.equal(sent.length, 2, 'the bell and the e-mail were sent');
      const events = await db.query(
        `SELECT published_at FROM outbox_events WHERE payload->>'submissionId' = $1
           AND payload->>'reason' = 'ASSIGNMENT_FINALIZED'`,
        [submissionId],
      );
      assert.equal(events.length, 1);
      assert.equal(events[0].published_at, null, 'the event waits for Kafka');
    } finally {
      await down.stop();
    }
  });
});
