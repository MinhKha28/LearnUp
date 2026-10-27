// Isolated PostgreSQL + HTTP k6 harness. Reuses installed dependencies; never migrates/builds.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const execute = require('node:util').promisify(require('node:child_process').execFile);
const current = path.resolve(__dirname, '../../services/learning-service');
const output = path.join(__dirname, 'results/reading-completion');
const side = process.argv[2];
const vus = Number(process.env.VUS), run = Number(process.env.RUN);
const materialType = process.env.MATERIAL_TYPE;
if (process.env.NODE_ENV === 'production' || !['baseline', 'branch'].includes(side) || ![1, 100, 200].includes(vus) || ![1, 2, 3].includes(run) || !['Video', 'Reading'].includes(materialType) || (side === 'baseline' && materialType !== 'Video')) throw new Error('Invalid isolated workload');
const root = side === 'baseline' ? process.env.BASELINE_SERVICE_ROOT : current;
if (!root || !process.env.DATABASE_URL || !process.env.INTERNAL_SERVICE_KEY) throw new Error('Missing harness configuration');
process.env.TS_NODE_PROJECT = path.join(root, 'tsconfig.seed.json');
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
process.env.NODE_PATH = [root, path.join(current, 'node_modules')].join(path.delimiter);
require('node:module').Module._initPaths();
require(path.join(current, 'node_modules/ts-node/register'));
require('reflect-metadata');
process.env.COMPLETION_WORKER_ENABLED = 'false'; // Observe enqueue counts/generation before consumption.
process.env.OUTBOX_RELAY_ENABLED = 'false';
process.env.VIDEO_PLAYBACK_MODE = 'course';
process.env.READING_ACCESS_MODE = 'course';
process.env.ASSESSMENT_CLIENT_MODE = 'fake';
process.env.ASSESSMENT_COMPLETION_CLIENT_MODE = 'fake';
process.env.TENANT_CLIENT_MODE = 'fake';
process.env.TENANT_FAKE_TIMEZONE = 'Asia/Ho_Chi_Minh';
process.env.TENANT_SERVICE_URL = 'http://127.0.0.1:1';
process.env.COURSE_SERVICE_URL = 'http://127.0.0.1:1';
process.env.COURSE_SERVICE_TIMEOUT_MS = '3000';
process.env.TENANT_SERVICE_TIMEOUT_MS = '3000';
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require(path.join(root, 'src/app.module'));
const { configureApp } = require(path.join(root, 'src/app.setup'));
const { PrismaService } = require(path.join(root, 'src/infrastructure/prisma/prisma.service'));
async function main() {
  fs.mkdirSync(output, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'reading-completion.js'), path.join(output, 'reading-completion.js'));
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app);
  await app.listen(8097, '0.0.0.0');
  const db = app.get(PrismaService);
  const org = randomUUID(), course = randomUUID(), material = randomUUID(), lesson = randomUUID();
  const iterations = 5, count = vus * iterations;
  const rows = Array.from({ length: count }, () => ({ id: randomUUID(), learner: randomUUID(), material, org }));
  const prefix = `${materialType.toLowerCase()}-${side}-${vus}-${run}`;
  try {
    await db.courseVersionSnapshot.create({ data: { courseId: course, organizationId: org, chainId: course, treeFetchedAt: new Date(), disabledAsOf: new Date() } });
    await db.materialSnapshot.create({ data: { materialId: material, organizationId: org, courseId: course, lessonId: lesson, materialType, isRequired: true,
      durationSeconds: materialType === 'Video' ? 100 : null, durationAsOf: materialType === 'Video' ? new Date() : null, disabledAsOf: new Date() } });
    await db.enrollment.createMany({ data: rows.map((r) => ({ id: r.id, organizationId: org, learnerId: r.learner, courseId: course, enrollmentType: 'Optional', videoCompletionPercent: 80 })) });
    // Warm HTTP/auth/DB paths without creating any activity.
    for (let i = 0; i < 5; i++) {
      const r = await fetch('http://127.0.0.1:8097/api/v1/enrollments/me/course-ids', { headers: {
        'x-internal-key': process.env.INTERNAL_SERVICE_KEY, 'x-organization-id': org, 'x-user-id': rows[0].learner, 'x-user-role': 'LEARNER',
      } });
      if (r.status !== 200) throw new Error('Warm-up failed');
      await r.arrayBuffer();
    }
    fs.writeFileSync(path.join(output, 'active-fixtures.json'), JSON.stringify(rows));
    let k6Exit = 0;
    try {
      await execute('docker', ['run', '--rm', '--pull=never', '--mount', `type=bind,source=${output},target=/scripts`,
      '-e', 'INTERNAL_SERVICE_KEY', '-e', `VUS=${vus}`, '-e', `ITERATIONS=${iterations}`, '-e', `MATERIAL_TYPE=${materialType}`,
      '-e', 'BASE_URL=http://host.docker.internal:8097', '-e', 'FIXTURES=/scripts/active-fixtures.json', '-e', `SUMMARY=/scripts/${prefix}.json`,
      'grafana/k6', 'run', '/scripts/reading-completion.js'], { maxBuffer: 8e6 });
    } catch (error) { k6Exit = Number(error.code) || 1; }
    const summary = JSON.parse(fs.readFileSync(path.join(output, `${prefix}.json`)));
    const [counts] = await db.$queryRawUnsafe(`SELECT
      (SELECT count(*)::int FROM material_progress WHERE organization_id=$1 AND completed_at IS NOT NULL) AS completions,
      (SELECT count(*)::int FROM enrollments WHERE organization_id=$1 AND status='InProgress' AND first_activity_at IS NOT NULL) AS activated,
      (SELECT count(*)::int FROM completion_evaluation_requests WHERE organization_id=$1 AND generation=0) AS requests,
      (SELECT count(*)::int FROM completion_evaluation_requests WHERE organization_id=$1 AND generation<>0) AS duplicate_signals`, org);
    const report = { side, materialType, vus, run, iterations, expected: count, counts,
      failureRate: summary.metrics.http_req_failed.values.rate, checks: summary.metrics.checks.values.rate,
      phases: Object.fromEntries(['first', 'duplicate'].map((phase) => [phase, summary.metrics[`http_req_duration{phase:${phase}}`].values])),
      k6Exit };
    fs.writeFileSync(path.join(output, `${prefix}-report.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await db.enrollment.deleteMany({ where: { organizationId: org } });
    await db.materialSnapshot.deleteMany({ where: { organizationId: org } });
    await db.courseVersionSnapshot.deleteMany({ where: { organizationId: org } });
    await app.close();
  }
}
main().catch((error) => { console.error('Reading performance harness failed:', error.name, error.message?.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database]')); process.exitCode = 1; });
