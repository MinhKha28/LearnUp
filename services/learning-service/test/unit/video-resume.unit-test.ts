import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { MaterialProgressService } from '../../src/modules/material-progress/material-progress.service';
import {
  MaterialProgressRepository,
  type ProgressRow,
  type ProgressPreview,
} from '../../src/modules/material-progress/material-progress.repository';
import type { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

const id = '27200000-0000-4000-8000-000000000001';
const user: CurrentUser = {
  userId: id,
  organizationId: id,
  role: 'LEARNER',
  isAuthenticated: true,
};
const at = new Date('2026-10-22T06:00:00Z');
const state = (): ProgressRow => ({
  watchedRanges: [],
  watchedSeconds: 0,
  completedAt: null,
  lastReportedAt: null,
  positionSeconds: null,
  positionReportedAt: null,
});

function fixture(status = 'NotStarted') {
  let row = state();
  const calls: string[] = [];
  const tx = {} as Prisma.TransactionClient;
  const repository = {
    transaction: async <T>(
      work: (tx: Prisma.TransactionClient) => Promise<T>,
    ) => work(tx),
    access: async () => {
      calls.push('access');
      return {
        id,
        courseId: id,
        status,
        videoCompletionPercent: 90,
        disabledAt: null,
      };
    },
    material: async () => ({
      materialId: id,
      lessonId: id,
      materialType: 'Video',
      durationSeconds: 100,
      disabledAt: null,
    }),
    disabledLesson: async () => false,
    lock: async () => {
      calls.push('lock');
      return row;
    },
    preview: async () => {
      calls.push('preview');
      return {
        ...row,
        watchedRanges: [[0, 100]],
        watchedSeconds: 100,
        newSeconds: 100,
        now: at,
      };
    },
    save: async () => {
      calls.push('coverage');
      row = {
        ...row,
        watchedRanges: [[0, 100]],
        watchedSeconds: 100,
        completedAt: at,
      };
      return row;
    },
    savePosition: async (
      _e: string,
      _m: string,
      _o: string,
      position: number,
      reported: Date,
    ) => {
      calls.push('position');
      row = { ...row, positionSeconds: position, positionReportedAt: reported };
      return row;
    },
  };
  return {
    calls,
    repository,
    service: new MaterialProgressService(
      repository as unknown as MaterialProgressRepository,
      {} as CourseServiceClient,
      { mode: 'fixture', fixtureUrl: 'https://example.test/video.mp4' },
      { mode: 'course' },
    ),
    setRow: (value: ProgressRow) => {
      row = value;
    },
  };
}

test('BR-184 Completed ignores coverage but still saves clamped position and preserves completion', async () => {
  const f = fixture('Completed');
  f.setRow({
    ...state(),
    watchedRanges: [[0, 90]],
    watchedSeconds: 90,
    completedAt: at,
  });
  const result = await f.service.report(user, id, id, {
    ranges: [[90, 100]],
    positionSeconds: 999,
    reportedAt: at.toISOString(),
  });
  assert.equal(result.positionSeconds, 100);
  assert.equal(result.watchedSeconds, 90);
  assert.equal(result.completedAt, at.toISOString());
  assert.ok(!f.calls.includes('preview'));
  assert.ok(!f.calls.includes('coverage'));
  assert.ok(f.calls.indexOf('access') < f.calls.indexOf('lock'));
});
test('BR-182 position-only report does not preview or save coverage', async () => {
  const f = fixture();
  const result = await f.service.report(user, id, id, {
    ranges: [],
    positionSeconds: 60,
    reportedAt: at.toISOString(),
  });
  assert.equal(result.positionSeconds, 60);
  assert.equal(result.watchedSeconds, 0);
  assert.equal(result.completed, false);
  assert.deepEqual(
    f.calls.filter((c) => ['preview', 'coverage', 'position'].includes(c)),
    ['position'],
  );
});
test('BR-181 accepts an entire video without a playback rate budget', async () => {
  const f = fixture();
  const result = await f.service.report(user, id, id, {
    ranges: [[0, 100]],
    positionSeconds: 100,
    reportedAt: at.toISOString(),
  });
  assert.equal(result.watchedSeconds, 100);
  assert.equal(result.completed, true);
  assert.equal('maxPlaybackRate' in result, false);
});

function repositoryFixture() {
  const queries: Prisma.Sql[] = [];
  let row = state();
  const tx = {
    $executeRaw: async (
      query: Prisma.Sql | TemplateStringsArray,
      ...values: unknown[]
    ) => {
      queries.push(
        Array.isArray(query)
          ? Prisma.sql(query as unknown as TemplateStringsArray, ...values)
          : (query as Prisma.Sql),
      );
      return 1;
    },
    $queryRaw: async () => [row],
  } as unknown as Prisma.TransactionClient;
  return {
    repository: new MaterialProgressRepository({} as PrismaService),
    tx,
    queries,
    setRow: (value: ProgressRow) => {
      row = value;
    },
  };
}
test('BR-140 activates only on the edge from incomplete to completed', async () => {
  for (const [previous, seconds, activates] of [
    [null, 10, false],
    [null, 90, true],
    [at, 100, false],
  ] as const) {
    const f = repositoryFixture();
    const preview: ProgressPreview = {
      ...state(),
      completedAt: previous,
      watchedSeconds: seconds,
      newSeconds: seconds,
      now: at,
    };
    await f.repository.save(id, id, id, preview, 90, [[0, seconds]], f.tx);
    assert.equal(
      f.queries.some((q) => q.sql.includes('UPDATE enrollments')),
      activates,
    );
  }
});
test('BR-182 position update requires a strictly newer client timestamp', async () => {
  const f = repositoryFixture();
  f.setRow({ ...state(), positionSeconds: 8, positionReportedAt: at });
  const result = await f.repository.savePosition(
    id,
    id,
    id,
    60,
    new Date(at.getTime() - 1000),
    f.tx,
  );
  assert.equal(result.positionSeconds, 8);
  assert.match(
    f.queries[0].sql,
    /position_reported_at IS NULL OR position_reported_at </,
  );
  assert.ok(!f.queries[0].sql.includes('watched_ranges='));
  assert.ok(!f.queries[0].sql.includes('completed_at='));
});
