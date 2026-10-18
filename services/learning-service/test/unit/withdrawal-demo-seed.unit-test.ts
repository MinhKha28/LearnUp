import assert from 'node:assert/strict';
import type { INestApplicationContext } from '@nestjs/common';
import { test } from 'node:test';
import { seedWithdrawalDemo } from '../../prisma/seed-withdrawal-demo';
import { WITHDRAWAL_DEMO_PLANS } from '../../prisma/withdrawal-demo-fixture';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { PlatformSettingsRepository } from '../../src/modules/platform-settings/platform-settings.repository';
import {
  ASSESSMENT_CLIENT,
  type AssessmentActivity,
} from '../../src/infrastructure/clients/assessment/assessment.client';

void test('withdrawal seed validates the configured client before accessing fixture data', async () => {
  const savedMode = process.env.ASSESSMENT_CLIENT_MODE;
  const savedNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const activity = (value: boolean): AssessmentActivity => ({
    hasQuizAttempt: value,
    hasSubmission: false,
    hasPeerReviewGiven: false,
  });
  try {
    for (const mode of ['fake', 'http']) {
      process.env.ASSESSMENT_CLIENT_MODE = mode;
      for (const scenario of ['valid', 'x-active', 'y-empty', 'unavailable']) {
        let reads = 0;
        const calls: string[] = [];
        const app = {
          get(token: unknown) {
            if (token === ASSESSMENT_CLIENT)
              return {
                async getActivity(_user: unknown, courseId: string) {
                  calls.push(courseId);
                  if (scenario === 'unavailable')
                    throw new Error('connection refused');
                  return activity(
                    courseId === WITHDRAWAL_DEMO_PLANS[0].courseId
                      ? scenario === 'x-active'
                      : scenario !== 'y-empty',
                  );
                },
              };
            if (token === PrismaService)
              return {
                enrollment: {
                  async findMany() {
                    reads++;
                    return WITHDRAWAL_DEMO_PLANS.map((p) => ({
                      id: p.enrollmentId,
                      courseId: p.courseId,
                      organizationId: '01900000-0000-7000-8000-00000000a001',
                      learnerId: '01900000-0000-7000-8000-00000000a206',
                    }));
                  },
                },
                materialProgress: {
                  async findMany() {
                    reads++;
                    return [];
                  },
                },
              };
            if (token === PlatformSettingsRepository)
              return { getVideoCompletionPercent: async () => 90 };
            throw new Error('Unexpected dependency or write');
          },
        } as unknown as INestApplicationContext;
        // Existing fixture makes a valid seed return without writing.
        if (scenario === 'valid') {
          await seedWithdrawalDemo(app);
          assert.equal(reads, 2);
        } else {
          const message =
            scenario === 'unavailable'
              ? /seed chưa ghi dữ liệu/
              : mode === 'fake'
                ? /ASSESSMENT_FAKE_RESULT_COURSE_IDS/
                : /db:seed:withdrawal-demo/;
          await assert.rejects(seedWithdrawalDemo(app), message);
          assert.equal(
            reads,
            0,
            'invalid assessment must stop before DB access',
          );
        }
        assert.equal(calls.length, 2);
      }
    }
  } finally {
    if (savedMode === undefined) delete process.env.ASSESSMENT_CLIENT_MODE;
    else process.env.ASSESSMENT_CLIENT_MODE = savedMode;
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
  }
});
