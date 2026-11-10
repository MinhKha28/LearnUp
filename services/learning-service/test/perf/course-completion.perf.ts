/** Disposable fixtures only. k6, API, PostgreSQL and Kafka share the same host. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  ASSESSMENT_COMPLETION_CLIENT,
  FakeAssessmentCompletionClient,
} from '../../src/infrastructure/clients/assessment/assessment-completion.client';
import {
  completionMaterialsSql,
  claimCompletionSql,
} from '../../src/modules/course-completion/completion.repository';
const execute = promisify(execFile);
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing production');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });
  configureApp(app);
  await app.listen(8097, '0.0.0.0');
  const db = app.get(PrismaService),
    fake = app.get<FakeAssessmentCompletionClient>(
      ASSESSMENT_COMPLETION_CLIENT,
    );
  const root = resolve('../../perf/learning'),
    results = resolve(root, 'results');
  mkdirSync(results, { recursive: true });
  const report: unknown[] = [];
  let previousP99 = 0;
  let stop = false;
  try {
    for (const vus of [1, 2, 100, 200, 1000, 2000]) {
      if (stop) break;
      for (let run = 1; run <= 3; run++) {
        const org = randomUUID(),
          course = randomUUID(),
          material = randomUUID(),
          lesson = randomUUID();
        const fixtures = Array.from({ length: vus }, () => ({
          id: randomUUID(),
          org,
          learner: randomUUID(),
          material,
        }));
        await db.courseVersionSnapshot.create({
          data: {
            courseId: course,
            organizationId: org,
            chainId: course,
            treeFetchedAt: new Date(),
            disabledAsOf: new Date(),
          },
        });
        await db.materialSnapshot.create({
          data: {
            materialId: material,
            organizationId: org,
            courseId: course,
            lessonId: lesson,
            materialType: 'Video',
            isRequired: true,
            durationSeconds: 100,
            durationAsOf: new Date(),
            disabledAsOf: new Date(),
          },
        });
        await db.enrollment.createMany({
          data: fixtures.map((f) => ({
            id: f.id,
            organizationId: org,
            learnerId: f.learner,
            courseId: course,
            enrollmentType: 'Optional',
            videoCompletionPercent: 80,
          })),
        });
        for (const f of fixtures)
          fake.fixtures.set([org, f.learner, course].join('/'), {
            value: {
              schemaVersion: 1,
              snapshotId: randomUUID(),
              asOf: new Date().toISOString(),
              revision: 'perf',
              organizationId: org,
              learnerId: f.learner,
              courseId: course,
              eligible: true,
              requiredComponentCount: 0,
              quizzes: [],
              assignments: [],
            },
          });
        const prefix = `course-completion-${vus}-${run}`;
        writeFileSync(
          resolve(results, `${prefix}-fixtures.json`),
          JSON.stringify(fixtures),
        );
        const plans: unknown[] = [];
        for (const sql of [
          completionMaterialsSql(org, course, fixtures[0].id),
          claimCompletionSql(5, 30000),
        ]) {
          const txPlan = await db.$transaction(async (tx) => {
            const plan = await tx.$queryRawUnsafe(
              `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql.text}`,
              ...sql.values,
            );
            return plan;
          });
          plans.push(txPlan);
        }
        writeFileSync(
          resolve(results, `${prefix}-explain.json`),
          JSON.stringify(plans, null, 2),
        );
        const cpu = process.cpuUsage(),
          started = Date.now();
        let maximumLocks = 0;
        const sample = setInterval(() => {
          void db.$queryRaw<
            { count: bigint }[]
          >`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`.then(
            (rows) => {
              maximumLocks = Math.max(maximumLocks, Number(rows[0].count));
            },
          );
        }, 100);
        let output = '';
        try {
          const result = await execute(
            'docker',
            [
              'run',
              '--rm',
              '--mount',
              `type=bind,source=${root},target=/scripts`,
              '-e',
              'INTERNAL_SERVICE_KEY',
              '-e',
              `VUS=${vus}`,
              '-e',
              'BASE_URL=http://host.docker.internal:8097',
              '-e',
              `FIXTURES=/scripts/results/${prefix}-fixtures.json`,
              '-e',
              `SUMMARY=/scripts/results/${prefix}-summary.json`,
              'grafana/k6',
              'run',
              '/scripts/course-completion.js',
            ],
            { maxBuffer: 4 * 1024 * 1024 },
          );
          output = result.stdout;
        } catch (error) {
          output = String(error);
          stop = true;
        }
        writeFileSync(resolve(results, `${prefix}-console.txt`), output);
        const deadline = Date.now() + 600000;
        while (Date.now() < deadline) {
          if (
            (await db.enrollment.count({
              where: { organizationId: org, status: 'Completed' },
            })) === vus &&
            (await db.outboxEvent.count({
              where: {
                organizationId: org,
                eventType: 'EnrollmentCompleted',
                publishedAt: { not: null },
              },
            })) === vus
          )
            break;
          await new Promise((r) => setTimeout(r, 200));
        }
        clearInterval(sample);
        const completed = await db.enrollment.count({
          where: { organizationId: org, status: 'Completed' },
        });
        const events = await db.outboxEvent.count({
          where: { organizationId: org, eventType: 'EnrollmentCompleted' },
        });
        const latency =
          await db.$queryRaw`SELECT percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM(e.completed_at-p.completed_at))*1000) AS p50,
          percentile_cont(0.95) WITHIN GROUP(ORDER BY extract(epoch FROM(e.completed_at-p.completed_at))*1000) AS p95 FROM enrollments e JOIN material_progress p ON p.enrollment_id=e.id WHERE e.organization_id=${org}::uuid`;
        const lag =
          await db.$queryRaw`SELECT count(*) FILTER(WHERE published_at IS NULL)::integer AS pending,percentile_cont(0.95) WITHIN GROUP(ORDER BY extract(epoch FROM(published_at-occurred_at))*1000) AS p95 FROM outbox_events WHERE organization_id=${org}::uuid`;
        const summary = JSON.parse(
          readFileSync(resolve(results, `${prefix}-summary.json`), 'utf8'),
        );
        const p99 =
          summary.metrics['http_req_duration{phase:trigger}'].values['p(99)'];
        const item = {
          vus,
          run,
          completed,
          events,
          expected: vus,
          latency,
          outboxLag: lag,
          workerPerSecond: completed / ((Date.now() - started) / 1000),
          maxSampledLockWaiters: maximumLocks,
          cpuMicroseconds: process.cpuUsage(cpu),
          memory: process.memoryUsage(),
          p99,
          failureRate: summary.metrics.http_req_failed.values.rate,
        };
        report.push(item);
        writeFileSync(
          resolve(results, 'course-completion-report.json'),
          JSON.stringify(report, null, 2),
        );
        console.log(JSON.stringify(item));
        if (
          completed !== vus ||
          events !== vus ||
          item.failureRate > 0.01 ||
          (previousP99 > 0 && p99 > Math.max(500, previousP99 * 3))
        )
          stop = true;
        previousP99 = p99;
        await db.outboxEvent.deleteMany({ where: { organizationId: org } });
        await db.enrollment.deleteMany({ where: { organizationId: org } });
        await db.materialSnapshot.deleteMany({
          where: { organizationId: org },
        });
        await db.courseVersionSnapshot.deleteMany({
          where: { organizationId: org },
        });
        fake.fixtures.clear();
        if (stop) {
          console.log(
            `Stopped after ${vus} VUs run ${run}; this is not a capacity limit.`,
          );
          break;
        }
      }
    }
  } finally {
    await app.close();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
