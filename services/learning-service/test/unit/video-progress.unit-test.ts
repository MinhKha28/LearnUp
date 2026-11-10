import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpException } from '@nestjs/common';
import {
  normalizeRanges,
  positionReportedAt,
  requiredSeconds,
} from '../../src/modules/material-progress/video-progress.rules';
import { ReportProgressPipe } from '../../src/modules/material-progress/report-progress.dto';

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
test('BR-182 clamps client timestamps more than 60 seconds ahead', () => {
  const now = new Date('2026-10-18T00:01:00Z');
  for (const offset of [-1000, 0, 60000, 60001]) {
    const candidate = new Date(now.getTime() + offset).toISOString();
    assert.equal(
      positionReportedAt(candidate, now).getTime(),
      offset > 60000 ? now.getTime() : Date.parse(candidate),
    );
  }
});
test('D88 required seconds uses ceil at completion boundary', () => {
  assert.equal(requiredSeconds(101, 90), 91);
  assert.equal(90 >= requiredSeconds(101, 90), false);
  assert.equal(91 >= requiredSeconds(101, 90), true);
});
test('BR-182 DTO accepts position-only reports and validates position, timestamp and ranges with existing 422', () => {
  const pipe = new ReportProgressPipe();
  const position = { positionSeconds: 1, reportedAt: '2026-10-22T06:00:00Z' };
  assert.deepEqual(pipe.transform({ ranges: [], ...position }), {
    ranges: [],
    ...position,
  });
  assert.deepEqual(pipe.transform({ ranges: [[0.2, 1.4]], ...position }), {
    ranges: [[0.2, 1.4]],
    ...position,
  });
  for (const body of [
    null,
    [],
    {},
    { ranges: [] },
    ...[
      Array(21).fill([0, 1]),
      [[0, 1, 2]],
      [[-1, 1]],
      [[1, 1]],
      [[2, 1]],
      [['0', 1]],
      [[0, Infinity]],
      [[0, NaN]],
    ].map((ranges) => ({ ranges, ...position })),
    { ranges: [], ...position, duration: 1 },
    ...[-1, 1.1, Infinity, NaN, '1'].map((positionSeconds) => ({
      ranges: [],
      ...position,
      positionSeconds,
    })),
    ...['bad', '2026-02-30T06:00:00Z', '2026-10-22', '2026-10-22T06:00:00'].map(
      (reportedAt) => ({ ranges: [], ...position, reportedAt }),
    ),
  ]) {
    assert.throws(
      () => pipe.transform(body),
      (e: HttpException) => e.getStatus() === 422,
    );
  }
  assert.equal(
    pipe.transform({ ranges: Array(20).fill([0, 1]), ...position }).ranges
      .length,
    20,
  );
});
