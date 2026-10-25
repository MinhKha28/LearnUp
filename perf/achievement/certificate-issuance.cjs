// Real PostgreSQL, synthetic directory/storage/transport. No live HTTP, Kafka or Cloudinary.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const os = require("node:os");
const fs = require("node:fs/promises");
const path = require("node:path");
const service = "../../services/achievement-reporting-service";
const { isolatedDatabase } = require(service + "/test/postgres.cjs");
const { event, delivery, config, directory } = require(
  service + "/test/fixtures.cjs",
);
const { IssuanceWorker } = require(
  service + "/dist/src/modules/certificates/issuance.worker",
);
const { CompletionConsumer } = require(
  service + "/dist/src/modules/certificates/completion.consumer",
);
async function run(count, withLogo, runNumber) {
  const fixture = await isolatedDatabase();
  const originalFetch = global.fetch;
  const cfg = config({ pollMs: 20, timeoutMs: 5000 });
  const dir = directory();
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  let uploaded = 0,
    committed = 0;
  if (withLogo)
    dir.profile = async (organizationId) => ({
      organizationId,
      name: "Synthetic Organization",
      logo: {
        url: "https://res.cloudinary.com/synthetic-logo",
        expiresAt: null,
        mimeType: null,
        sizeBytes: null,
      },
    });
  global.fetch = async () => new Response(png);
  const storage = {
    upload: async (_row, image, key) => {
      uploaded++;
      return {
        key,
        hash: createHash("sha256").update(image.bytes).digest("hex"),
        mime: image.mime,
        size: image.bytes.length,
      };
    },
    delete: async () => {},
  };
  const worker = new IssuanceWorker(fixture.repository, cfg, dir, storage);
  const consumer = new CompletionConsumer(fixture.repository, worker, cfg);
  const samples = [];
  try {
    const began = performance.now();
    worker.onModuleInit();
    for (let i = 0; i < count; i++) {
      const completedAt = new Date().toISOString();
      const payload = event({ completedAt, occurredAt: completedAt });
      await consumer.handle(delivery(payload, String(i)), async () => {
        committed++;
      });
      if (i % 10 === 0)
        samples.push(await fixture.repository.metricsAcrossOrganizations());
    }
    let metric;
    const deadline = began + 30000;
    do {
      await new Promise((resolve) => setTimeout(resolve, 20));
      metric = await fixture.repository.metricsAcrossOrganizations();
      samples.push(metric);
      if (performance.now() > deadline) throw new Error("PERF_TIMEOUT");
    } while (metric.issued !== count);
    const elapsedMs = performance.now() - began;
    const counts = (
      await fixture.pool.query(
        "SELECT (SELECT count(*)::int FROM processed_completion_events) AS receipts,(SELECT count(*)::int FROM completion_event_quarantine) AS quarantined",
      )
    ).rows[0];
    assert.equal(metric.backlog, 0);
    assert.equal(committed, count);
    assert.equal(counts.receipts, count);
    assert.equal(counts.quarantined, 0);
    assert.equal(uploaded, withLogo ? count : 0);
    return {
      run: runNumber,
      scenario: withLogo ? "fake-logo" : "no-logo",
      events: count,
      issued: metric.issued,
      committed,
      ...counts,
      elapsedMs,
      certificatesPerSecond: count / (elapsedMs / 1000),
      p50Ms: metric.p50,
      p95Ms: metric.p95,
      p99Ms: metric.p99,
      peakBacklog: Math.max(...samples.map((x) => x.backlog)),
      peakOldestPendingSeconds: Math.max(
        ...samples.map((x) => x.oldestPendingSeconds),
      ),
      finalBacklog: metric.backlog,
      configuration: {
        consumerTransport: "direct handler (fake Kafka)",
        directory: "in-memory fake",
        storage: "in-memory fake",
        logoFetch: "fake Response; 8-byte synthetic PNG signature",
        workerEnabled: true,
        concurrency: cfg.concurrency,
        pollMs: cfg.pollMs,
        leaseMs: cfg.leaseMs,
      },
    };
  } finally {
    await worker.onModuleDestroy();
    global.fetch = originalFetch;
    await fixture.cleanup();
  }
}
async function main() {
  const count = Number(process.env.CERTIFICATE_PERF_EVENTS ?? 100);
  if (!Number.isSafeInteger(count) || count < 1 || count > 10000)
    throw new Error("Invalid event count");
  const report = {
    measuredAt: new Date().toISOString(),
    topology: {
      platform: os.platform(),
      release: os.release(),
      architecture: os.arch(),
      node: process.version,
      logicalCpus: os.cpus().length,
      cpu: os.cpus()[0].model,
      totalMemoryGiB: +(os.totalmem() / 2 ** 30).toFixed(2),
      database: "PostgreSQL 16.15 in existing local Docker; TCP loopback",
      application: "one Node process on host; no HTTP gateway",
    },
    runs: [],
  };
  for (const withLogo of [false, true])
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await run(count, withLogo, attempt);
      report.runs.push(result);
      console.log(JSON.stringify(result));
    }
  const folder = path.join(__dirname, "results");
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(
    path.join(folder, "issuance.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ topology: report.topology }));
}
main().catch(() => {
  console.error(
    "CERTIFICATE_PERF_FAILED; no credentials or raw dependency errors are printed",
  );
  process.exitCode = 1;
});
