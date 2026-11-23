import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CourseStub } from '../integration/course-stub';

test('Course stub rejects absent configuration and recovers when a key is configured', async () => {
  const previousKey = process.env.INTERNAL_SERVICE_KEY;
  const previousTimeout = process.env.COURSE_SERVICE_TIMEOUT_MS;
  process.env.COURSE_SERVICE_TIMEOUT_MS = '1000';
  const server = await new CourseStub().start();
  try {
    delete process.env.INTERNAL_SERVICE_KEY;
    const missing = await fetch(server.url);
    assert.equal(missing.status, 401);

    const key = 'course-stub-unit-key';
    process.env.INTERNAL_SERVICE_KEY = key;
    for (const provided of ['', 'wrong', key]) {
      const response = await fetch(server.url, {
        headers: { 'x-internal-key': provided },
      });
      assert.equal(response.status, provided === key ? 404 : 401);
    }

    process.env.INTERNAL_SERVICE_KEY = '';
    const empty = await fetch(server.url, {
      headers: { 'x-internal-key': '' },
    });
    assert.equal(empty.status, 401);
  } finally {
    await server.close();
    if (previousKey === undefined) delete process.env.INTERNAL_SERVICE_KEY;
    else process.env.INTERNAL_SERVICE_KEY = previousKey;
    if (previousTimeout === undefined)
      delete process.env.COURSE_SERVICE_TIMEOUT_MS;
    else process.env.COURSE_SERVICE_TIMEOUT_MS = previousTimeout;
  }
});
