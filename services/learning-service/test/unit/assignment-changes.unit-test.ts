import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import { AssignmentChangesService } from '../../src/modules/assignments/assignment-changes.service';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  assertExtendable,
  assertExemptible,
  assertExemptionRemovable,
  validateExtension,
} from '../../src/modules/assignments/assignment-change-rules';
import {
  ExtendAssignmentDto,
  ExemptAssignmentDto,
  RemoveExemptionBodyPipe,
} from '../../src/modules/assignments/change-assignment.dto';

describe('UC24.3 / UC24.5 rules and DTOs', () => {
  for (const status of ['NotStarted', 'InProgress', 'Exempted', 'Halted'])
    test(`extend ${status}`, () =>
      assert.doesNotThrow(() => assertExtendable(status)));
  for (const status of ['Completed', 'Withdrawn'])
    test(`reject extension ${status}`, () =>
      assert.throws(() => assertExtendable(status), /Không thể/));
  for (const status of [
    'NotStarted',
    'Completed',
    'Withdrawn',
    'Halted',
    'Exempted',
  ])
    test(`reject exemption ${status}`, () =>
      assert.throws(() => assertExemptible(status), /Chỉ có thể/));
  test('exempt InProgress', () =>
    assert.doesNotThrow(() => assertExemptible('InProgress')));
  const today = '2026-10-16';
  const previous = new Date('2026-01-01Z');
  for (const date of [
    today,
    '2027-10-16',
    '2027-10-17',
    '2100-12-31',
    '9999-12-31',
  ])
    test(`inclusive boundary ${date}`, () =>
      assert.ok(
        validateExtension(previous, new Date(`${date}T17:00Z`), date, today) >
          0n,
      ));
  for (const [date, message] of [['2026-10-15', 'trước hôm nay']])
    test(`reject date ${date}`, () =>
      assert.throws(
        () =>
          validateExtension(previous, new Date(`${date}T17:00Z`), date, today),
        new RegExp(message),
      ));
  test('not later checked before past', () =>
    assert.throws(
      () => validateExtension(previous, previous, '2025-01-01', today),
      /sau hạn/,
    ));
  test('NFC, trim and preserve newline', () => {
    const dto = plainToInstance(ExemptAssignmentDto, {
      reason: '  miễn\nhọc  ',
    });
    assert.equal(dto.reason, 'miễn\nhọc');
    assert.equal(validateSync(dto).length, 0);
  });
  for (const reason of [undefined, null, '', ' \n ', 3, 'x'.repeat(1001)])
    test(`invalid mandatory reason ${String(reason).slice(0, 20)}`, () =>
      assert.ok(
        validateSync(plainToInstance(ExemptAssignmentDto, { reason })).length,
      ));
  test('1000 normalized characters allowed', () =>
    assert.equal(
      validateSync(
        plainToInstance(ExemptAssignmentDto, { reason: 'é'.repeat(1000) }),
      ).length,
      0,
    ));
  for (const date of [
    '2026-02-30',
    '2100-02-29',
    '2026-2-01',
    '2026-10-16T00:00:00Z',
    'bad',
  ])
    test(`invalid calendar date ${date}`, () =>
      assert.ok(
        validateSync(plainToInstance(ExtendAssignmentDto, { newDueDate: date }))
          .length,
      ));
  for (const newDueDate of ['2100-12-31', '9999-12-30', '9999-12-31'])
    test(`valid four-digit calendar date ${newDueDate}`, () =>
      assert.equal(
        validateSync(plainToInstance(ExtendAssignmentDto, { newDueDate }))
          .length,
        0,
      ));
  test('optional reason permits empty but rejects null and excess length', () => {
    for (const reason of [undefined, '  '])
      assert.equal(
        validateSync(
          plainToInstance(ExtendAssignmentDto, { newDueDate: today, reason }),
        ).length,
        0,
      );
    for (const reason of [null, 'x'.repeat(1001)])
      assert.ok(
        validateSync(
          plainToInstance(ExtendAssignmentDto, { newDueDate: today, reason }),
        ).length,
      );
  });
});

describe('UC24.6 removal validation', () => {
  test('only Exempted can be removed', () => {
    assert.doesNotThrow(() => assertExemptionRemovable('Exempted'));
    for (const status of [
      'NotStarted',
      'InProgress',
      'Completed',
      'Halted',
      'Withdrawn',
    ]) {
      assert.throws(() => assertExemptionRemovable(status), { status: 409 });
    }
  });

  test('accepts no payload or an empty object', () => {
    const pipe = new RemoveExemptionBodyPipe();
    assert.doesNotThrow(() => pipe.transform(undefined));
    assert.doesNotThrow(() => pipe.transform({}));
    for (const body of [null, [], 'reason', { reason: 'text' }])
      assert.throws(() => pipe.transform(body), { status: 422 });
  });
});

for (const { scenario, status, disabled } of [
  { scenario: 'no activity', status: 'NotStarted', disabled: false },
  { scenario: 'partial activity', status: 'InProgress', disabled: false },
  {
    scenario: 'eligible for completion',
    status: 'InProgress',
    disabled: false,
  },
  { scenario: 'disabled version', status: 'Halted', disabled: true },
]) {
  test(`UC24.6 returns the saved result for ${scenario}`, async () => {
    const user = {
      userId: 'organizer',
      organizationId: 'org',
      role: 'ORGANIZER',
    } as CurrentUser;
    const saved = { row: { status }, intervals: [] };
    const result = { status };
    const steps: string[] = [];
    const tx = {
      $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
        assert.match(strings.join(''), /completion_evaluation_requests/);
        assert.equal(values.at(-1), 'ASSIGNMENT_RESTORE');
        steps.push('queue');
        return Promise.resolve(1);
      },
    };
    const candidate = { courseId: 'course', status: 'Exempted' };
    const service = new AssignmentChangesService(
      {
        $transaction: async (run: (client: typeof tx) => unknown) => {
          steps.push('transaction');
          const value = await run(tx);
          steps.push('commit');
          return value;
        },
      } as never,
      {
        find: async () => candidate,
        lock: async () => {
          steps.push('lock');
          return candidate;
        },
        removeExemption: async (
          client: typeof tx,
          org: string,
          id: string,
          disabledCourse: boolean,
        ) => {
          assert.equal(client, tx);
          assert.deepEqual(
            [org, id, disabledCourse],
            ['org', 'enrollment', disabled],
          );
          steps.push('remove');
        },
      } as never,
      {
        detailSnapshot: async (org: string, id: string, client: typeof tx) => {
          assert.deepEqual([org, id, client], ['org', 'enrollment', tx]);
          steps.push('snapshot');
          return saved;
        },
        detail: async (_user: CurrentUser, id: string, snapshot: unknown) => {
          assert.equal(id, 'enrollment');
          assert.equal(snapshot, saved);
          steps.push('detail');
          return result;
        },
      } as never,
      {} as never,
      {
        getOrganizationAccess: async () => ({
          organizationStatus: 'Active',
          subscriptionStatus: 'Active',
          timezone: 'UTC',
        }),
      } as never,
      {
        getCourseTree: async (_user: CurrentUser, courseId: string) => {
          assert.equal(courseId, 'course');
          steps.push('course');
          return { disabledAt: disabled ? new Date(0) : null };
        },
      } as never,
    );
    assert.equal(await service.removeExemption(user, 'enrollment'), result);
    assert.deepEqual(steps, [
      'course',
      'transaction',
      'lock',
      'remove',
      ...(disabled ? [] : ['queue']),
      'snapshot',
      'commit',
      'detail',
    ]);
  });
}

test('fractional extension 112500.428 is floored to whole seconds', () => {
  assert.equal(
    validateExtension(
      new Date('2026-10-13T16:44:59.572Z'),
      new Date('2026-10-15T00:00:00Z'),
      '2026-10-14',
      '2026-10-13',
    ),
    112500n,
  );
});
test('positive sub-second extension uses the existing not-later validation error', () => {
  assert.throws(
    () =>
      validateExtension(
        new Date('2026-10-14T23:59:59.572Z'),
        new Date('2026-10-15T00:00:00Z'),
        '2026-10-14',
        '2026-10-13',
      ),
    (error: { getResponse(): unknown }) =>
      typeof error.getResponse === 'function' &&
      JSON.stringify(error.getResponse()).includes('DUE_DATE_NOT_LATER'),
  );
});

test('hidden microseconds at an exact JS second are floored without crossing midnight', () => {
  assert.equal(
    validateExtension(
      new Date('2026-10-13T16:44:59.000Z'),
      new Date('2026-10-14T17:00:00Z'),
      '2026-10-14',
      '2026-10-13',
      true,
    ),
    87300n,
  );
});
test('hidden microseconds making an extension shorter than one second are rejected', () => {
  assert.throws(
    () =>
      validateExtension(
        new Date('2026-10-14T16:59:59.000Z'),
        new Date('2026-10-14T17:00:00Z'),
        '2026-10-14',
        '2026-10-13',
        true,
      ),
    /sau hạn/,
  );
});
