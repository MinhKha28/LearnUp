/**
 * COURSE_CLIENT_MODE through the real service: the safe default (http), the fake mode that needs no Course Service,
 * and how a failing Course Service is reported.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  OTHER_INSTRUCTOR,
  startCourseStub,
  startService,
  type CourseStub,
  type TestDatabase,
} from './harness';

const body = {
  courseId: COURSE,
  title: 'T',
  prompt: 'p',
  passingScore: 70,
  expectedDurationMinutes: 60,
  rubric: [{ name: 'a', description: 'd', maxPoints: 10 }],
};

describe('Course client modes', () => {
  let db: TestDatabase;
  let course: CourseStub;

  before(async () => {
    db = await createTestDatabase();
    course = await startCourseStub();
  });
  after(async () => {
    await course?.stop();
    await db?.drop();
  });

  test('fake mode runs without any Course Service and warns about it', async () => {
    const service = await startService(db.url, { COURSE_CLIENT_MODE: 'fake' });
    try {
      const api = apiFor(service.baseUrl);
      assert.equal((await api('POST', '/assignments', body)).status, 201);
      assert.match(service.log(), /\[FAKE\]/);
      // documented limit: every Course counts as the caller's own, so the owner check does not apply
      const other = await api(
        'POST',
        '/assignments',
        body,
        identity({ user: OTHER_INSTRUCTOR }),
      );
      assert.equal(other.status, 201);
    } finally {
      await service.stop();
    }
  });

  test('fake mode can pretend the Course is Locked or in review', async () => {
    const locked = await startService(db.url, {
      COURSE_CLIENT_MODE: 'fake',
      FAKE_COURSE_LOCKED: 'true',
    });
    try {
      const r = await apiFor(locked.baseUrl)('POST', '/assignments', body);
      assert.equal(r.status, 409);
      assert.equal(r.code, 'COURSE_LOCKED');
    } finally {
      await locked.stop();
    }

    const inReview = await startService(db.url, {
      COURSE_CLIENT_MODE: 'fake',
      FAKE_COURSE_STATUS: 'Submitted',
    });
    try {
      const r = await apiFor(inReview.baseUrl)('POST', '/assignments', body);
      assert.equal(r.status, 409);
      assert.equal(r.code, 'COURSE_NOT_EDITABLE');
    } finally {
      await inReview.stop();
    }
  });

  test('the default is http: with Course Service down it answers 503, it does not fall back to the fake', async () => {
    // COURSE_CLIENT_MODE is left to the harness default (http) and the address points nowhere
    const service = await startService(db.url, {
      COURSE_SERVICE_URL: 'http://127.0.0.1:9',
    });
    try {
      const r = await apiFor(service.baseUrl)('POST', '/assignments', body);
      assert.equal(r.status, 503);
      assert.equal(r.code, 'COURSE_SERVICE_UNAVAILABLE');
      assert.doesNotMatch(service.log(), /\[FAKE\]/);
    } finally {
      await service.stop();
    }
  });

  test('http mode reports what Course Service said', async () => {
    const service = await startService(db.url, {
      COURSE_SERVICE_URL: course.url,
    });
    try {
      const api = apiFor(service.baseUrl);

      course.state.respond = '404';
      const missing = await api('POST', '/assignments', body);
      assert.equal(missing.status, 404);
      assert.equal(missing.code, 'COURSE_NOT_FOUND');

      course.state.respond = '500';
      const broken = await api('POST', '/assignments', body);
      assert.equal(broken.status, 503);
      assert.equal(broken.code, 'COURSE_SERVICE_UNAVAILABLE');

      course.state.respond = 'ok';
      assert.equal((await api('POST', '/assignments', body)).status, 201);
    } finally {
      await service.stop();
    }
  });
});
