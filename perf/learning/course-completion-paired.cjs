// One side of one paired burst; all probes are harness-only and opt-in.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { promisify } = require("node:util");
const execute = promisify(require("node:child_process").execFile);
const { AsyncLocalStorage } = require("node:async_hooks");
const { performance } = require("node:perf_hooks");
const current = path.resolve(__dirname, "../../services/learning-service");
const kind = process.argv[2];
if (
  !["baseline", "branch"].includes(kind) ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Disposable baseline/branch mode required");
const root = kind === "baseline" ? process.env.BASELINE_SERVICE_ROOT : current;
if (!root) throw new Error("BASELINE_SERVICE_ROOT required");
process.env.TS_NODE_PROJECT = path.join(root, "tsconfig.seed.json");
process.env.TS_NODE_TRANSPILE_ONLY = "true";
process.env.NODE_PATH = root + path.delimiter + current + "/node_modules";
require("node:module").Module._initPaths();
require(current + "/node_modules/ts-node/register");
require("reflect-metadata");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require(root + "/src/app.module");
const { configureApp } = require(root + "/src/app.setup");
const { PrismaService } = require(
  root + "/src/infrastructure/prisma/prisma.service",
);
const output = path.join(__dirname, "results", "completion-paired");
fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(
  path.join(__dirname, "course-completion.js"),
  path.join(output, "course-completion.js"),
);
const quantile = (values, q) => {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b),
    i = (v.length - 1) * q;
  return (
    v[Math.floor(i)] +
    (v[Math.ceil(i)] - v[Math.floor(i)]) * (i - Math.floor(i))
  );
};
const stats = (a) => ({
  n: a.length,
  p50: quantile(a, 0.5),
  p95: quantile(a, 0.95),
  p99: quantile(a, 0.99),
});
function probe(repo, service, fake, traces) {
  const context = new AsyncLocalStorage(),
    claim = repo.claim.bind(repo);
  repo.claim = async (...args) => {
    const rows = await claim(...args);
    for (const r of rows)
      traces.set(r.enrollment_id, {
        id: r.enrollment_id,
        requested: +r.requested_at,
        claimed: +r.next_attempt_at - repo.config.leaseMs,
      });
    return rows;
  };
  const evaluate = service.evaluate.bind(service);
  service.evaluate = (r) =>
    context.run(traces.get(r.enrollment_id), () => evaluate(r));
  const get = fake.getCompletionSnapshot.bind(fake);
  fake.getCompletionSnapshot = async (...args) => {
    const t = context.getStore(),
      start = performance.now();
    try {
      return await get(...args);
    } finally {
      if (t) t.assessment = performance.now() - start;
    }
  };
  const transaction = repo.prisma.$transaction.bind(repo.prisma);
  repo.prisma.$transaction = async (work, options) => {
    const t = context.getStore();
    if (!t || typeof work !== "function") return transaction(work, options);
    const start = performance.now();
    try {
      return await transaction(async (tx) => {
        t.pool = performance.now() - start;
        const entered = performance.now();
        try {
          return await work(tx);
        } finally {
          t.callback = performance.now() - entered;
        }
      }, options);
    } finally {
      t.transaction = performance.now() - start;
      t.finished = Date.now();
    }
  };
}
async function main() {
  const vus = Number(process.env.VUS),
    run = Number(process.env.RUN);
  if (![1, 2, 100, 200, 1000, 2000].includes(vus) || ![1, 2, 3].includes(run))
    throw new Error("Invalid VUS/RUN");
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"],
  });
  configureApp(app);
  await app.listen(8097, "0.0.0.0");
  const db = app.get(PrismaService),
    traces = new Map();
  let fake;
  if (kind === "branch") {
    const { CompletionRepository } = require(
      current + "/src/modules/course-completion/completion.repository",
    );
    const { CompletionService } = require(
      current + "/src/modules/course-completion/completion.service",
    );
    const { ASSESSMENT_COMPLETION_CLIENT } = require(
      current +
        "/src/infrastructure/clients/assessment/assessment-completion.client",
    );
    fake = app.get(ASSESSMENT_COMPLETION_CLIENT);
    if (process.env.COMPLETION_PERF_PHASES === "true")
      probe(
        app.get(CompletionRepository),
        app.get(CompletionService),
        fake,
        traces,
      );
  }
  const file = path.join(output, `fixture-${vus}-${run}.json`);
  let fixture;
  if (fs.existsSync(file)) fixture = JSON.parse(fs.readFileSync(file));
  else {
    const org = randomUUID(),
      course = randomUUID(),
      material = randomUUID(),
      lesson = randomUUID();
    fixture = {
      org,
      course,
      material,
      lesson,
      rows: Array.from({ length: vus }, () => ({
        id: randomUUID(),
        learner: randomUUID(),
        org,
        material,
      })),
    };
    fs.writeFileSync(file, JSON.stringify(fixture));
  }
  const { org, course, material, lesson, rows } = fixture;
  try {
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
        materialType: "Video",
        isRequired: true,
        durationSeconds: 100,
        durationAsOf: new Date(),
        disabledAsOf: new Date(),
      },
    });
    await db.enrollment.createMany({
      data: rows.map((r) => ({
        id: r.id,
        organizationId: org,
        learnerId: r.learner,
        courseId: course,
        enrollmentType: "Optional",
        videoCompletionPercent: 80,
      })),
    });
    if (fake)
      for (const r of rows)
        fake.fixtures.set([org, r.learner, course].join("/"), {
          value: {
            schemaVersion: 1,
            snapshotId: randomUUID(),
            asOf: new Date().toISOString(),
            revision: "paired-perf",
            organizationId: org,
            learnerId: r.learner,
            courseId: course,
            eligible: true,
            requiredComponentCount: 0,
            quizzes: [],
            assignments: [],
          },
        });
    fs.writeFileSync(
      path.join(output, "active-fixtures.json"),
      JSON.stringify(rows),
    );
    const prefix = `${kind}-${vus}-${run}`;
    let failed = false;
    try {
      const { stdout } = await execute(
        "docker",
        [
          "run",
          "--rm",
          "--mount",
          `type=bind,source=${output},target=/scripts`,
          "-e",
          "INTERNAL_SERVICE_KEY",
          "-e",
          `VUS=${vus}`,
          "-e",
          "BASE_URL=http://host.docker.internal:8097",
          "-e",
          "FIXTURES=/scripts/active-fixtures.json",
          "-e",
          `SUMMARY=/scripts/${prefix}.json`,
          "grafana/k6",
          "run",
          "/scripts/course-completion.js",
        ],
        { maxBuffer: 8e6 },
      );
      fs.writeFileSync(path.join(output, prefix + ".log"), stdout);
    } catch (error) {
      failed = true;
      fs.writeFileSync(path.join(output, prefix + ".log"), String(error));
    }
    const deadline = Date.now() + 120000;
    if (fake)
      while (
        Date.now() < deadline &&
        (await db.enrollment.count({
          where: { organizationId: org, status: "Completed" },
        })) !== vus
      )
        await new Promise((r) => setTimeout(r, 100));
    const summary = JSON.parse(
        fs.readFileSync(path.join(output, prefix + ".json")),
      ),
      raw = [...traces.values()];
    const completed = await db.enrollment.count({
        where: { organizationId: org, status: "Completed" },
      }),
      events = await db.outboxEvent.count({
        where: { organizationId: org, eventType: "EnrollmentCompleted" },
      });
    const result = {
      kind,
      vus,
      run,
      failed,
      failureRate: summary.metrics.http_req_failed.values.rate,
      checks: summary.metrics.checks.values.rate,
      phases: Object.fromEntries(
        ["coverage", "trigger"].map((p) => [
          p,
          summary.metrics[`http_req_duration{phase:${p}}`].values,
        ]),
      ),
      completed,
      events,
      queue: stats(raw.map((t) => t.claimed - t.requested)),
      assessment: stats(raw.map((t) => t.assessment)),
      transaction: stats(raw.map((t) => t.transaction)),
      pool: stats(raw.map((t) => t.pool)),
      total: stats(raw.map((t) => t.finished - t.requested)),
      rawTraces: raw,
    };
    fs.writeFileSync(
      path.join(output, prefix + "-report.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify({ ...result, rawTraces: undefined }));
  } finally {
    await db.outboxEvent.deleteMany({ where: { organizationId: org } });
    await db.enrollment.deleteMany({ where: { organizationId: org } });
    await db.materialSnapshot.deleteMany({ where: { organizationId: org } });
    await db.courseVersionSnapshot.deleteMany({
      where: { organizationId: org },
    });
    await app.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
