import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpException } from '@nestjs/common';
import {
  normalizeRanges,
  progressBudget,
  requiredSeconds,
} from '../../src/modules/material-progress/video-progress.rules';
import { ReportProgressPipe } from '../../src/modules/material-progress/report-progress.dto';
import { readVideoPlaybackConfig } from '../../src/modules/material-progress/video-playback.config';

test('D86 rounds inward, clips duration and drops empty intervals', () => {
  assert.deepEqual(
    normalizeRanges(
      [
        [0.1, 1.9],
        [1, 2],
        [9.1, 10.8],
        [3.1, 3.9],
      ],
      10,
    ),
    [[1, 2]],
  );
  assert.deepEqual(normalizeRanges([[0, 10.9]], 10), [[0, 10]]);
});
test('D87 first report, exact boundary, one second over, elapsed cap and backward clock', () => {
  const now = new Date('2026-10-18T00:01:00Z');
  assert.equal(progressBudget(now, null), 45);
  const budget = progressBudget(now, new Date(now.getTime() - 15000));
  assert.equal(budget, 35);
  assert.equal(35 <= budget, true);
  assert.equal(36 <= budget, false);
  assert.equal(progressBudget(now, new Date(now.getTime() - 120000)), 125);
  assert.equal(progressBudget(now, new Date(now.getTime() + 1000)), 5);
  assert.equal(progressBudget(now, new Date(now.getTime() - 1)), 6);
});
test('D88 required seconds uses ceil at completion boundary', () => {
  assert.equal(requiredSeconds(101, 90), 91);
  assert.equal(90 >= requiredSeconds(101, 90), false);
  assert.equal(91 >= requiredSeconds(101, 90), true);
});
test('progress DTO accepts only 1–20 ordered finite nonnegative pairs without extra keys', () => {
  const pipe = new ReportProgressPipe();
  assert.deepEqual(pipe.transform({ ranges: [[0.2, 1.4]] }), {
    ranges: [[0.2, 1.4]],
  });
  for (const body of [
    null,
    [],
    {},
    { ranges: [] },
    { ranges: Array(21).fill([0, 1]) },
    { ranges: [[0, 1]], duration: 1 },
    { ranges: [[0, 1, 2]] },
    { ranges: [[-1, 1]] },
    { ranges: [[1, 1]] },
    { ranges: [[2, 1]] },
    { ranges: [['0', 1]] },
    { ranges: [[0, Infinity]] },
    { ranges: [[0, NaN]] },
  ]) {
    assert.throws(
      () => pipe.transform(body),
      (e: HttpException) => e.getStatus() === 422,
    );
  }
  assert.equal(
    pipe.transform({ ranges: Array(20).fill([0, 1]) }).ranges.length,
    20,
  );
});
test('D85 fixture is explicit, validates URL, refuses production; course can start in production', () => {
  const config = (values: Record<string, string>) =>
    readVideoPlaybackConfig((key) => values[key]);
  assert.throws(() => config({}));
  assert.throws(() => config({ VIDEO_PLAYBACK_MODE: 'other' }));
  assert.throws(() =>
    config({
      VIDEO_PLAYBACK_MODE: 'fixture',
      NODE_ENV: 'production',
      VIDEO_FIXTURE_URL: 'https://example.test/a.mp4',
    }),
  );
  assert.throws(() => config({ VIDEO_PLAYBACK_MODE: 'fixture' }));
  assert.throws(() =>
    config({
      VIDEO_PLAYBACK_MODE: 'fixture',
      VIDEO_FIXTURE_URL: 'file:///a.mp4',
    }),
  );
  assert.deepEqual(
    config({ VIDEO_PLAYBACK_MODE: 'course', NODE_ENV: 'production' }),
    { mode: 'course' },
  );
  assert.equal(
    config({
      VIDEO_PLAYBACK_MODE: 'fixture',
      VIDEO_FIXTURE_URL: 'https://example.test/a.mp4',
    }).fixtureUrl,
    'https://example.test/a.mp4',
  );
});
