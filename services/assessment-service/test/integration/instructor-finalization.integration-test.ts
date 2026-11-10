import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  INSTRUCTOR,
  LEARNER,
  ORG,
  OTHER_INSTRUCTOR,
  OTHER_ORG,
  sleep,
  startCourseStub,
  startService,
  type ApiResult,
  type CourseStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const asLearner = (user = LEARNER) => identity({ user, role: 'LEARNER' });

function expectCode(result: ApiResult, status: number, code: string) {
  assert.equal(result.status, status, JSON.stringify(result.json));
  assert.equal(result.code, code);
}

describe('UC32.3 Assignment finalization over HTTP', () => {
  let db: TestDatabase;
  let course: CourseStub;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;

  async function submit(assignmentId: string, replace = false) {
    const form = new FormData();
    form.set('content', replace ? 'Replacement work' : 'My work');
    const action = replace ? 'resubmissions' : 'submissions';
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignmentId}/${action}`,
      { method: 'POST', headers: asLearner(), body: form },
    );
    const json = (await response.json()) as { data: { id: string } };
    assert.equal(response.status, 201, JSON.stringify(json));
    return json.data.id;
  }

  async function createSubmission() {
    const result = await api('POST', '/assignments', {
      courseId: COURSE,
      title: 'Finalization exercise',
      prompt: 'Write an essay.',
      passingScore: 70,
      expectedDurationMinutes: 30,
      rubric: [
        { name: 'Content', description: 'Main argument', maxPoints: 100 },
      ],
    });
    assert.equal(result.status, 201, JSON.stringify(result.json));
    const assignmentId = result.data.id as string;
    const [{ id }] = await db.query(
      'SELECT id FROM rubric_criteria WHERE assessment_id = $1',
      [assignmentId],
    );
    const submissionId = await submit(assignmentId);
    return { assignmentId, submissionId, criterionId: id as string };
  }

  const finalize = (
    id: string,
    body: Record<string, unknown> = { finalScore: 80 },
    headers?: Record<string, string>,
  ) => api('POST', `/submissions/${id}/finalize`, body, headers);

  const reviewBody = (criterionId: string, points: number) => ({
    scores: [{ criterionId, points }],
    comment: 'Clear argument.',
  });

  async function grade(submissionId: string, criterionId: string, points = 80) {
    const result = await api(
      'POST',
      `/submissions/${submissionId}/instructor-review`,
      reviewBody(criterionId, points),
    );
    assert.equal(result.status, 201, JSON.stringify(result.json));
    assert.equal(result.data.gradingStatus, 'AwaitingFinalization');
    return result.data;
  }

  async function addReview(
    submissionId: string,
    status: string,
    score: number | null,
  ) {
    await db.query(
      `INSERT INTO submission_reviews
         (id, organization_id, submission_id, reviewer_id, reviewer_role, status, score, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'Learner', $4, $5, now(), now())`,
      [ORG, submissionId, randomUUID(), status, score],
    );
  }

  const events = (submissionId: string) =>
    db.query(
      `SELECT aggregate_id, aggregate_type, event_type, organization_id, occurred_at, payload
     FROM outbox_events WHERE payload->>'submissionId' = $1
       AND payload->>'reason' = 'ASSIGNMENT_FINALIZED'`,
      [submissionId],
    );

  async function assertUnpublished(submissionId: string) {
    const [row] = await db.query(
      `SELECT grading_status, final_score, finalization_comment, finalized_at, finalized_by
       FROM submissions WHERE id = $1`,
      [submissionId],
    );
    assert.deepEqual(row, {
      grading_status: 'AwaitingFinalization',
      final_score: null,
      finalization_comment: null,
      finalized_at: null,
      finalized_by: null,
    });
    assert.equal((await events(submissionId)).length, 0);
  }

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
    service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
      ENROLLMENT_CLIENT_MODE: 'fake',
      OUTBOX_RELAY_ENABLED: 'false',
    });
    api = apiFor(service.baseUrl);
  });

  after(async () => {
    await service?.stop();
    await course?.stop();
    await db?.drop();
  });

  test('submission detail returns a nullable numeric aggregate and the latest attempt', async () => {
    const { assignmentId, submissionId, criterionId } = await createSubmission();
    const path = `/submissions/${submissionId}`;
    const initial = await api('GET', path);
    assert.equal(initial.status, 200, JSON.stringify(initial.json));
    assert.equal(initial.data.aggregateScore, null);
    assert.equal(initial.data.isLatest, true);

    const replacementId = await submit(assignmentId, true);
    const old = await api('GET', path);
    assert.equal(old.data.isLatest, false);

    await grade(replacementId, criterionId, 80);
    const replacementPath = `/submissions/${replacementId}`;
    const graded = await api('GET', replacementPath);
    assert.equal(graded.data.isLatest, true);
    assert.equal(graded.data.aggregateScore, 80);

    await addReview(replacementId, 'Completed', 80.01);
    const rounded = await api('GET', replacementPath);
    assert.equal(rounded.data.aggregateScore, 80.01);
    const result = await finalize(replacementId, {
      finalScore: rounded.data.aggregateScore,
    });
    assert.equal(result.status, 200, JSON.stringify(result.json));
    assert.equal(result.data.finalScore, rounded.data.aggregateScore);
    assert.equal(result.data.finalizationComment, null);
  });

  test('submission detail keeps Instructor and organization access checks', async () => {
    const { submissionId } = await createSubmission();
    const path = `/submissions/${submissionId}`;
    expectCode(await api('GET', path, undefined, asLearner()), 403, 'FORBIDDEN');
    expectCode(
      await api('GET', path, undefined, identity({ org: OTHER_ORG })),
      404,
      'SUBMISSION_NOT_FOUND',
    );
    expectCode(
      await api('GET', path, undefined, identity({ user: OTHER_INSTRUCTOR })),
      404,
      'ASSIGNMENT_NOT_FOUND',
    );
  });

  test('BR-250 / BR-254: publish after two completed peer reviews', async () => {
    const { assignmentId, submissionId, criterionId } =
      await createSubmission();
    const reviewers = [randomUUID(), randomUUID()];
    const [{ id: cycleId }] = await db.query(
      `INSERT INTO peer_review_cycles
         (id, organization_id, assessment_id, opens_at, closes_at, review_due_at, reviewers_per_submission,
          score_gap, reminder_hours, status, reviewer_permutation, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, now() - interval '2 days', now() - interval '1 day',
               now() + interval '1 day', 2, 20, 12, 'Assigned', $3, now(), now()) RETURNING id`,
      [ORG, assignmentId, reviewers],
    );
    await db.query(
      "UPDATE submissions SET cycle_id = $1, grading_status = 'AwaitingPeerReview' WHERE id = $2",
      [cycleId, submissionId],
    );
    const reviewIds = [];
    for (const reviewerId of reviewers) {
      const [{ id }] = await db.query(
        `INSERT INTO submission_reviews
           (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Learner', 'Pending', now(), now()) RETURNING id`,
        [ORG, submissionId, cycleId, reviewerId],
      );
      reviewIds.push(id);
    }
    for (const [index, id] of reviewIds.entries()) {
      const result = await api(
        'POST',
        `/learner/peer-reviews/${id}`,
        reviewBody(criterionId, 75 + index * 10),
        asLearner(reviewers[index]),
      );
      assert.equal(result.status, 200, JSON.stringify(result.json));
    }
    const result = await finalize(submissionId);
    assert.equal(result.status, 200, JSON.stringify(result.json));
    assert.equal(result.data.finalScore, 80);
    assert.equal((await events(submissionId)).length, 1);
  });

  test('publish a directly graded submission and expose it through both Learner result routes', async () => {
    const { assignmentId, submissionId, criterionId } =
      await createSubmission();
    const resultPath = `/learner/assignments/${assignmentId}/result`;
    await grade(submissionId, criterionId);
    expectCode(
      await api('GET', resultPath, undefined, asLearner()),
      409,
      'SUBMISSION_NOT_FINALIZED',
    );

    const published = await finalize(submissionId);
    assert.equal(published.status, 200, JSON.stringify(published.json));
    const { finalizedAt } = published.data;
    assert.equal(new Date(finalizedAt).toISOString(), finalizedAt);
    assert.deepEqual(published.data, {
      submissionId,
      gradingStatus: 'Finalized',
      finalScore: 80,
      finalizationComment: null,
      finalizedAt,
    });

    const [row] = await db.query(
      'SELECT finalized_by, finalized_at FROM submissions WHERE id = $1',
      [submissionId],
    );
    assert.equal(row.finalized_by, INSTRUCTOR);
    assert.equal((row.finalized_at as Date).toISOString(), finalizedAt);
    const [{ id: stateId }] = await db.query(
      'SELECT id FROM learner_assessment_states WHERE assessment_id = $1',
      [assignmentId],
    );
    const rows = await events(submissionId);
    assert.equal(rows.length, 1);
    const [event] = rows;
    assert.equal(event.aggregate_id, stateId);
    assert.equal(event.aggregate_type, 'LearnerAssessmentState');
    assert.equal(event.event_type, 'LearnerAssessmentStatusChanged');
    assert.equal(event.organization_id, ORG);
    assert.equal((event.occurred_at as Date).toISOString(), finalizedAt);
    assert.deepEqual(event.payload, {
      assessmentId: assignmentId,
      courseId: COURSE,
      learnerId: LEARNER,
      organizationId: ORG,
      kind: 'ASSIGNMENT',
      status: 'Finalized',
      reason: 'ASSIGNMENT_FINALIZED',
      submissionId,
      finalScore: 80,
      finalizedAt,
      revision: (event.payload as { revision: string }).revision,
      firstActivityAt: (event.payload as { firstActivityAt: string })
        .firstActivityAt,
    });
    assert.ok((event.payload as { revision: string }).revision);
    assert.ok(
      Number.isFinite(
        Date.parse(
          (event.payload as { firstActivityAt: string }).firstActivityAt,
        ),
      ),
    );

    const latest = await api('GET', resultPath, undefined, asLearner());
    const historical = await api(
      'GET',
      `/learner/assignments/${assignmentId}/submissions/${submissionId}/result`,
      undefined,
      asLearner(),
    );
    assert.equal(latest.status, 200);
    assert.equal(historical.status, 200);
    assert.deepEqual(latest.data, historical.data);
    assert.equal(latest.data.finalScore, 80);
    assert.equal(latest.data.finalizedAt, finalizedAt);
    assert.equal(latest.data.passed, true);
    assert.equal(latest.data.criteria[0].averagePoints, 80);
    assert.equal(latest.data.comments[0].comment, 'Clear argument.');

    await submit(assignmentId, true);
    expectCode(
      await api('GET', resultPath, undefined, asLearner()),
      409,
      'SUBMISSION_NOT_FINALIZED',
    );
    const supersededResult = await api(
      'GET',
      `/learner/assignments/${assignmentId}/submissions/${submissionId}/result`,
      undefined,
      asLearner(),
    );
    assert.equal(supersededResult.status, 200);
    assert.deepEqual(supersededResult.data, historical.data);
    expectCode(
      await finalize(submissionId),
      409,
      'SUBMISSION_ALREADY_FINALIZED',
    );
    assert.equal((await events(submissionId)).length, 1);
  });

  test('BR-255: a changed score requires an explanation, which is trimmed on publication', async () => {
    const { submissionId, criterionId } = await createSubmission();
    await grade(submissionId, criterionId);
    for (const body of [
      { finalScore: 81 },
      { finalScore: 81, comment: '  ' },
    ]) {
      expectCode(
        await finalize(submissionId, body),
        400,
        'FINALIZATION_COMMENT_REQUIRED',
      );
    }
    const tooLong = await finalize(submissionId, {
      finalScore: 81,
      comment: ' ' + 'a'.repeat(2001) + ' ',
    });
    assert.equal(tooLong.status, 400);
    assert.deepEqual(tooLong.json.error.message, [
      'Nhận xét không được vượt quá 2.000 ký tự.',
    ]);
    await assertUnpublished(submissionId);

    const result = await finalize(submissionId, {
      finalScore: 81,
      comment: '  Adjusted for the optional section.  ',
    });
    assert.equal(result.status, 200, JSON.stringify(result.json));
    assert.equal(
      result.data.finalizationComment,
      'Adjusted for the optional section.',
    );
    const [{ finalization_comment }] = await db.query(
      'SELECT finalization_comment FROM submissions WHERE id = $1',
      [submissionId],
    );
    assert.equal(finalization_comment, result.data.finalizationComment);
  });

  test('rejects invalid score formats and accepts the endpoints 0 and 100', async () => {
    const zero = await createSubmission();
    await grade(zero.submissionId, zero.criterionId, 0);
    for (const finalScore of [-0.01, 100.01, 60.001, 1e-7, '60']) {
      const result = await finalize(zero.submissionId, { finalScore });
      assert.equal(result.status, 400, JSON.stringify(result.json));
      assert.deepEqual(result.json.error.message, [
        'Điểm cuối cùng phải là số từ 0 đến 100 và có tối đa 2 chữ số thập phân.',
      ]);
    }
    assert.equal(
      (await finalize(zero.submissionId, { finalScore: 0, comment: null }))
        .status,
      400,
    );
    await assertUnpublished(zero.submissionId);
    const result = await finalize(zero.submissionId, {
      finalScore: 0,
      comment: '  ',
    });
    assert.equal(result.status, 200, JSON.stringify(result.json));
    assert.equal(result.data.finalScore, 0);
    assert.equal(result.data.finalizationComment, null);

    const max = await createSubmission();
    await grade(max.submissionId, max.criterionId, 100);
    const top = await finalize(max.submissionId, { finalScore: 100 });
    assert.equal(top.status, 200, JSON.stringify(top.json));
    assert.equal(top.data.finalScore, 100);
  });

  test('grade preserves the aggregate and finalize compares the same rounded hundredths', async () => {
    const { submissionId, criterionId } = await createSubmission();
    await addReview(submissionId, 'Completed', 0.1);
    await addReview(submissionId, 'Completed', 0.2);
    await addReview(submissionId, 'Completed', null);
    await addReview(submissionId, 'Pending', 99);
    const gradeResult = await grade(submissionId, criterionId, 0);
    assert.equal(gradeResult.review.score, 0);
    assert.equal(gradeResult.validReviewCount, 3);
    assert.equal(gradeResult.suggestedScore, 0.1);
    const result = await finalize(submissionId, { finalScore: 0.1 });
    assert.equal(result.status, 200, JSON.stringify(result.json));
    assert.equal(result.data.finalScore, 0.1);
  });

  test('keeps existing access errors and their messages', async () => {
    const { submissionId } = await createSubmission();
    const cases = [
      {
        headers: asLearner(),
        status: 403,
        code: 'FORBIDDEN',
        message: 'Only an Instructor can review submissions.',
      },
      {
        headers: identity({ org: OTHER_ORG }),
        status: 404,
        code: 'SUBMISSION_NOT_FOUND',
        message: 'Submission not found.',
      },
      {
        headers: identity({ user: OTHER_INSTRUCTOR }),
        status: 404,
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Assignment not found.',
      },
    ];
    for (const { headers, status, code, message } of cases) {
      const result = await finalize(submissionId, { finalScore: 80 }, headers);
      expectCode(result, status, code);
      assert.equal(result.json.error.message, message);
    }
    course.state.respond = '404';
    try {
      const result = await finalize(submissionId);
      expectCode(result, 404, 'COURSE_NOT_FOUND');
      assert.equal(result.json.error.message, 'Course not found.');
    } finally {
      course.reset();
    }
    assert.equal((await events(submissionId)).length, 0);
  });

  test('rejects an ungraded attempt and a superseded graded attempt', async () => {
    const { assignmentId, submissionId, criterionId } =
      await createSubmission();
    expectCode(
      await finalize(submissionId),
      409,
      'SUBMISSION_NOT_AWAITING_FINALIZATION',
    );
    await grade(submissionId, criterionId);
    await submit(assignmentId, true);
    expectCode(await finalize(submissionId), 409, 'SUBMISSION_NOT_LATEST');
    await assertUnpublished(submissionId);
  });

  test('incomplete review or Learner state is logged and cannot publish', async () => {
    const noScores = await createSubmission();
    await db.query(
      "UPDATE submissions SET grading_status = 'AwaitingFinalization' WHERE id = $1",
      [noScores.submissionId],
    );
    const noState = await createSubmission();
    await grade(noState.submissionId, noState.criterionId);
    await db.query(
      'DELETE FROM learner_assessment_states WHERE assessment_id = $1',
      [noState.assignmentId],
    );
    for (const { submissionId } of [noScores, noState]) {
      expectCode(
        await finalize(submissionId),
        409,
        'SUBMISSION_STATE_INCOMPLETE',
      );
      await assertUnpublished(submissionId);
      assert.ok(
        service
          .log()
          .includes(
            `Incomplete finalization state for submission ${submissionId}`,
          ),
      );
    }
  });

  test('two simultaneous publish requests produce one success and one conflict', async () => {
    const { submissionId, criterionId } = await createSubmission();
    await grade(submissionId, criterionId);
    const results = await Promise.all([
      finalize(submissionId),
      finalize(submissionId),
    ]);
    const [success, conflict] = results.sort((a, b) => a.status - b.status);
    assert.equal(success.status, 200, JSON.stringify(success.json));
    expectCode(conflict, 409, 'SUBMISSION_ALREADY_FINALIZED');
    assert.equal((await events(submissionId)).length, 1);
  });

  test('resubmission queued first supersedes the attempt before finalize can publish', async () => {
    const { assignmentId, submissionId, criterionId } =
      await createSubmission();
    await grade(submissionId, criterionId);
    const blocker = await db.connect();
    const waitsForAdvisoryLock = async (count: number) => {
      for (let i = 0; i < 40; i++) {
        const [{ waiting }] = await db.query(
          `SELECT count(*)::int AS waiting FROM pg_locks WHERE locktype = 'advisory' AND NOT granted
             AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
             AND objid::bigint = (hashtext($1)::bigint & 4294967295)`,
          [`${assignmentId}:${LEARNER}`],
        );
        if (waiting === count) return;
        await sleep(25);
      }
      assert.fail(
        `Expected ${count} requests waiting on the Assignment/Learner lock`,
      );
    };

    const requests: Promise<unknown>[] = [];
    await blocker.query('BEGIN');
    try {
      await blocker.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `${assignmentId}:${LEARNER}`,
      ]);
      const replacement = submit(assignmentId, true);
      requests.push(replacement);
      void replacement.catch(() => {});
      await waitsForAdvisoryLock(1);
      const publication = finalize(submissionId);
      requests.push(publication);
      await waitsForAdvisoryLock(2);
      // Finalize must still be waiting for the advisory lock when we take the row lock.
      await blocker.query(
        'SELECT id FROM submissions WHERE id = $1 FOR UPDATE NOWAIT',
        [submissionId],
      );
      await blocker.query('COMMIT');

      assert.notEqual(await replacement, submissionId);
      expectCode(await publication, 409, 'SUBMISSION_NOT_LATEST');
      await assertUnpublished(submissionId);
    } finally {
      await blocker.query('ROLLBACK');
      await Promise.allSettled(requests);
    }
  });

  test('a failure inserting the outbox event rolls back publication', async () => {
    const { submissionId, criterionId } = await createSubmission();
    await grade(submissionId, criterionId);
    await db.query(`
      CREATE FUNCTION reject_finalization_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.payload->>'reason' = 'ASSIGNMENT_FINALIZED' THEN
          RAISE EXCEPTION 'test rejects finalization outbox insert';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER reject_finalization_event BEFORE INSERT ON outbox_events
        FOR EACH ROW EXECUTE FUNCTION reject_finalization_event();
    `);
    try {
      assert.equal((await finalize(submissionId)).status, 500);
      await assertUnpublished(submissionId);
    } finally {
      await db.query(
        'DROP TRIGGER reject_finalization_event ON outbox_events; DROP FUNCTION reject_finalization_event()',
      );
    }
    assert.equal((await finalize(submissionId)).status, 200);
    assert.equal((await events(submissionId)).length, 1);
  });
});
