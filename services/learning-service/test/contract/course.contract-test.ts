/** Opt-in, read-only HTTP format check. Never imports integration fixtures or opens PostgreSQL. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import type {
  CourseBatchItem,
  LessonContent,
} from '../../src/infrastructure/clients/course/course-service.interface';
import { parseCourseTree } from '../../src/infrastructure/clients/course/course-service.contract';
import { readCourseServiceConfig } from '../../src/infrastructure/clients/course/course-service.config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Set ${name} for the read-only Course contract check`);
  return value;
}
function record(value: unknown): Record<string, unknown> {
  assert.ok(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'Expected object',
  );
  return value as Record<string, unknown>;
}
const string = (value: unknown) => {
  assert.equal(typeof value, 'string');
};
const integer = (value: unknown) => {
  assert.ok(Number.isInteger(value));
};
const nullableString = (value: unknown) => {
  if (value !== null) string(value);
};
const date = (value: unknown) => {
  string(value);
  assert.ok(Number.isFinite(Date.parse(value as string)), 'Expected ISO date');
};
function fields<T>(
  value: unknown,
  checks: { [K in keyof T]-?: (v: unknown) => void },
) {
  const row = record(value);
  for (const [key, check] of Object.entries(checks) as [
    string,
    (v: unknown) => void,
  ][]) {
    assert.ok(Object.hasOwn(row, key), `Missing ${key}`);
    try {
      check(row[key]);
    } catch (error) {
      throw new Error(`Invalid ${key}`, { cause: error });
    }
  }
}

async function main() {
  if (process.env.COURSE_CONTRACT_CHECK !== 'true')
    throw new Error('Opt-in required: set COURSE_CONTRACT_CHECK=true');
  const config = readCourseServiceConfig((key) => process.env[key]);
  const courseId = required('COURSE_CONTRACT_COURSE_ID');
  const lessonId = required('COURSE_CONTRACT_LESSON_ID');
  const headers = {
    'x-internal-key': config.internalKey,
    'x-user-id': required('COURSE_CONTRACT_USER_ID'),
    'x-organization-id': required('COURSE_CONTRACT_ORGANIZATION_ID'),
    'x-user-role': required('COURSE_CONTRACT_USER_ROLE'),
    'content-type': 'application/json',
  };
  const read = async (path: string, body?: unknown): Promise<unknown> => {
    const result = await fetch(
      `${config.baseUrl}/api/v1/internal/courses${path}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      },
    );
    assert.ok(result.ok, `Course read returned HTTP ${result.status}`);
    return record(await result.json()).data;
  };
  const tree = record(await read(`/${encodeURIComponent(courseId)}/tree`));
  string(tree.courseId);
  parseCourseTree(tree, tree.courseId as string);
  const batch = await read('/batch', { courseIds: [courseId] });
  assert.ok(Array.isArray(batch), 'Batch data must be an array');
  assert.ok(
    batch.length > 0,
    'Choose a readable Course so batch format can be checked',
  );
  for (const item of batch)
    fields<CourseBatchItem>(item, {
      courseId: string,
      chainId: string,
      versionNumber: integer,
      name: string,
      courseType: string,
      status: string,
      coverFileId: nullableString,
    });
  fields<LessonContent>(
    await read(
      `/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
    ),
    {
      lessonId: string,
      courseId: string,
      title: string,
      content: string,
      disabledAt: (value) => {
        if (value !== null) date(value);
      },
    },
  );
  console.log(
    'Course tree, batch and lesson response formats match Learning contracts (read-only).',
  );
}
main().catch((error: unknown) => {
  // Do not print server data, headers or credentials.
  console.error(
    `[learning → course] Contract check failed: ${error instanceof Error ? error.message : 'unknown error'}. Raise a [learning → course] issue with the endpoint and field, without credentials or response data.`,
  );
  process.exitCode = 1;
});
