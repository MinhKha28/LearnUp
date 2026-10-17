import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, test } from 'node:test';
import { HttpException } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import {
  createAssessmentClient,
  HttpAssessmentClient,
} from '../../src/infrastructure/clients/assessment/create-assessment-client';
import {
  AssessmentUnavailableError,
  hasAssessmentActivity,
} from '../../src/infrastructure/clients/assessment/assessment.client';
import { EnrollmentWithdrawalService } from '../../src/modules/enrollments/enrollment-withdrawal.service';
import {
  assertRestorable,
  assertWithdrawable,
} from '../../src/modules/enrollments/optional-enrollment.rules';
import type { OptionalEnrollmentRow } from '../../src/modules/enrollments/optional-enrollment.repository';
import { EnrollmentsService } from '../../src/modules/enrollments/enrollments.service';

const user: CurrentUser = {
  userId: '0199a000-0000-7000-8000-0b0000000004',
  organizationId: '0199a000-0000-7000-8000-0a0000000001',
  role: 'LEARNER',
  isAuthenticated: true,
};
const row: OptionalEnrollmentRow = {
  id: '0199a000-0000-7000-8000-2a0000000004',
  courseId: '0199a000-0000-7000-8000-0e0000000002',
  learnerId: user.userId,
  organizationId: user.organizationId!,
  status: 'InProgress',
  enrollmentType: 'Optional',
  withdrawnReason: null,
};
const apiError =
  (code: string, reason?: string, status = 409) =>
  (error: unknown) => {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), status);
    const body = error.getResponse() as Record<string, unknown>;
    assert.equal(body.code, code);
    if (reason) assert.equal(body.reason, reason);
    return true;
  };

void describe('UC25.4 withdrawal rules and assessment factory', () => {
  for (const [patch, reason] of [
    [{ enrollmentType: 'Required' }, 'REQUIRED'],
    [{ status: 'Completed' }, 'COMPLETED'],
  ] as const)
    void test(`409 ${reason}`, () =>
      assert.throws(
        () => assertWithdrawable({ ...row, ...patch }),
        apiError('ENROLLMENT_NOT_WITHDRAWABLE', reason),
      ));
  for (const status of ['NotStarted', 'InProgress', 'Halted'])
    void test(`allows Optional ${status}`, () =>
      assert.doesNotThrow(() => assertWithdrawable({ ...row, status })));
  for (const value of [null, { ...row, status: 'Withdrawn' }])
    void test(`missing or Withdrawn returns 404 (${value?.status ?? 'missing'})`, () =>
      assert.throws(
        () => assertWithdrawable(value),
        apiError('ENROLLMENT_NOT_FOUND', undefined, 404),
      ));
  for (const reason of ['AccountDeleted', 'HaltedClosed']) {
    void test(`D82 ${reason} checked before Subscription/I1`, async () => {
      const service = new EnrollmentsService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        undefined,
        {
          findRegistration: async () => ({
            ...row,
            status: 'Withdrawn',
            withdrawnReason: reason,
          }),
        } as never,
      );
      await assert.rejects(
        service.enrollOptional(user, row.courseId),
        apiError('ENROLLMENT_NOT_RESTORABLE', reason),
      );
    });
  }
  void test('LearnerWithdrew can be restored; active row remains ALREADY_ENROLLED', () => {
    assert.doesNotThrow(() =>
      assertRestorable({
        ...row,
        status: 'Withdrawn',
        withdrawnReason: 'LearnerWithdrew',
      }),
    );
    assert.throws(() => assertRestorable(row), apiError('ALREADY_ENROLLED'));
  });
  void test('fake validates configuration and refuses production', async () => {
    const config: Record<string, string> = {
      ASSESSMENT_CLIENT_MODE: 'fake',
      ASSESSMENT_FAKE_RESULT_COURSE_IDS: ` ${row.courseId}, ${row.id} `,
    };
    const get = (key: string) => config[key];
    const client = createAssessmentClient(get);
    assert.deepEqual(await client.getActivity(user, row.courseId), {
      hasQuizAttempt: true,
      hasSubmission: true,
      hasPeerReviewGiven: true,
    });
    assert.equal(
      hasAssessmentActivity(await client.getActivity(user, user.userId)),
      false,
    );
    for (const value of ['bad', `${row.id},`, `${row.id},bad`]) {
      config.ASSESSMENT_FAKE_RESULT_COURSE_IDS = value;
      assert.throws(() => createAssessmentClient(get), /UUID/);
    }
    config.NODE_ENV = 'production';
    assert.throws(() => createAssessmentClient(get), /production/);
    assert.throws(() => createAssessmentClient(() => undefined), /MODE/);
  });
  for (const activity of [
    { hasQuizAttempt: true, hasSubmission: false, hasPeerReviewGiven: false },
    { hasQuizAttempt: false, hasSubmission: true, hasPeerReviewGiven: false },
    { hasQuizAttempt: false, hasSubmission: false, hasPeerReviewGiven: true },
  ])
    void test(`any assessment flag is sufficient: ${JSON.stringify(activity)}`, () =>
      assert.equal(hasAssessmentActivity(activity), true));

  for (const outcome of [
    'DELETED',
    'WITHDRAWN',
    'ERROR',
    'CONVERTED',
    'COMPLETED',
    'WITHDRAWN_AGAIN',
    'DELETED_AGAIN',
  ] as const) {
    void test(`withdraw ${outcome}: assessment outside transaction; locked row rechecked`, async () => {
      const calls: string[] = [];
      let inTransaction = false;
      const service = new EnrollmentWithdrawalService(
        {
          $transaction: async (fn: (tx: unknown) => unknown) => {
            inTransaction = true;
            calls.push('transaction');
            return fn({});
          },
        } as never,
        {
          findOwned: async () => row,
          lock: async () =>
            outcome === 'DELETED_AGAIN'
              ? null
              : {
                  ...row,
                  enrollmentType:
                    outcome === 'CONVERTED' ? 'Required' : 'Optional',
                  status:
                    outcome === 'COMPLETED'
                      ? 'Completed'
                      : outcome === 'WITHDRAWN_AGAIN'
                        ? 'Withdrawn'
                        : 'InProgress',
                },
          remove: async () => {
            calls.push('delete');
          },
          withdraw: async () => {
            calls.push('withdraw');
          },
        } as never,
        {
          getActivity: async () => {
            assert.equal(inTransaction, false);
            calls.push('assessment');
            if (outcome === 'ERROR') throw new Error('timeout');
            return {
              hasQuizAttempt: outcome !== 'DELETED',
              hasSubmission: false,
              hasPeerReviewGiven: false,
            };
          },
        },
      );
      const promise = service.withdraw(user, row.id);
      if (outcome === 'ERROR') {
        await assert.rejects(
          promise,
          apiError('ASSESSMENT_UNAVAILABLE', undefined, 503),
        );
        assert.deepEqual(calls, ['assessment']);
      } else if (outcome === 'CONVERTED' || outcome === 'COMPLETED') {
        await assert.rejects(
          promise,
          apiError(
            'ENROLLMENT_NOT_WITHDRAWABLE',
            outcome === 'CONVERTED' ? 'REQUIRED' : 'COMPLETED',
          ),
        );
        assert.deepEqual(calls, ['assessment', 'transaction']);
      } else if (outcome === 'WITHDRAWN_AGAIN' || outcome === 'DELETED_AGAIN') {
        await assert.rejects(
          promise,
          apiError('ENROLLMENT_NOT_FOUND', undefined, 404),
        );
        assert.deepEqual(calls, ['assessment', 'transaction']);
      } else {
        assert.deepEqual(await promise, { outcome });
        assert.deepEqual(calls, [
          'assessment',
          'transaction',
          outcome === 'DELETED' ? 'delete' : 'withdraw',
        ]);
      }
    });
  }

  void test('http forwards headers and validates booleans, errors and timeout', async () => {
    let mode = 'ok';
    const server = createServer((req, res) => {
      assert.equal(
        req.url,
        `/api/v1/internal/learners/${user.userId}/courses/${row.courseId}/assessment-activity`,
      );
      assert.equal(req.headers['x-internal-key'], 'test-key');
      assert.equal(req.headers['x-user-id'], user.userId);
      assert.equal(req.headers['x-user-role'], user.role);
      assert.equal(req.headers['x-organization-id'], user.organizationId);
      if (mode === 'timeout') return;
      if (mode === 'http') {
        res.writeHead(500);
        res.end();
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(
        mode === 'json'
          ? '{'
          : JSON.stringify({
              data: {
                hasQuizAttempt: mode === 'type' ? 'false' : false,
                hasSubmission: false,
                hasPeerReviewGiven: false,
              },
            }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const config: Record<string, string> = {
      ASSESSMENT_CLIENT_MODE: 'http',
      ASSESSMENT_SERVICE_URL: url,
      INTERNAL_SERVICE_KEY: 'test-key',
      ASSESSMENT_SERVICE_TIMEOUT_MS: '1000',
    };
    try {
      const client = createAssessmentClient((key) => config[key]);
      assert.equal(
        hasAssessmentActivity(await client.getActivity(user, row.courseId)),
        false,
      );
      for (const value of ['type', 'json', 'http']) {
        mode = value;
        await assert.rejects(
          client.getActivity(user, row.courseId),
          AssessmentUnavailableError,
        );
      }
      mode = 'timeout';
      await assert.rejects(
        new HttpAssessmentClient(url, 'test-key', 50).getActivity(
          user,
          row.courseId,
        ),
        AssessmentUnavailableError,
      );
      for (const value of ['0', 'x', '1.2']) {
        config.ASSESSMENT_SERVICE_TIMEOUT_MS = value;
        assert.throws(
          () => createAssessmentClient((key) => config[key]),
          /TIMEOUT/,
        );
      }
      config.ASSESSMENT_SERVICE_URL = 'ftp://example.test';
      assert.throws(() => createAssessmentClient((key) => config[key]), /HTTP/);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await assert.rejects(
      new HttpAssessmentClient(url, 'test-key', 50).getActivity(
        user,
        row.courseId,
      ),
      AssessmentUnavailableError,
    );
  });
});
