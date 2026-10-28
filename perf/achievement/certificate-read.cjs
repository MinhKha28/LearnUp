const { fork } = require("node:child_process");
const { resolve } = require("node:path");
const { writeFileSync } = require("node:fs");
const { cpus, totalmem } = require("node:os");
const root = resolve(__dirname, "../../services/achievement-reporting-service");
const { isolatedDatabase } = require(root + "/test/postgres.cjs");
const { user, seed, headers } = require(
  root + "/test/certificate-read.helpers.cjs",
);
const { png, hash } = require(root + "/test/signer.helpers.cjs");
const percentile = (values, p) =>
  values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] ?? 0;
async function main() {
  if (!process.env.CERTIFICATE_PERF_OUTPUT)
    throw Error(
      "CERTIFICATE_PERF_OUTPUT is required and must point outside the repository",
    );
  const f = await isolatedDatabase();
  const u = user();
  let child;
  console.log(
    JSON.stringify({
      retainedSchema: f.schema,
      cleanup: 'DROP SCHEMA "' + f.schema + '" CASCADE;',
    }),
  );
  try {
    const id = await seed(f, u, {
      assets: {
        logo: {
          key: "synthetic/perf/logo",
          mime: "image/png",
          hash: hash(png()),
          size: png().length,
        },
      },
    });
    for (let i = 0; i < 39; i++) await seed(f, u);
    await f.db.$disconnect();
    await f.pool.end();
    child = fork(resolve(__dirname, "certificate-read-worker.cjs"), [], {
      env: {
        ...process.env,
        DATABASE_URL: f.connectionString,
        NODE_ENV: "test",
      },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
    });
    const receive = (type) =>
      new Promise((done, reject) => {
        const timer = setTimeout(() => {
          child.off("message", listen);
          reject(Error("Performance worker timed out"));
        }, 30000);
        const listen = (message) => {
          if (message.type === type) {
            clearTimeout(timer);
            child.off("message", listen);
            done(message);
          } else if (message.type === "failed") {
            clearTimeout(timer);
            child.off("message", listen);
            reject(Error("Performance worker failed"));
          }
        };
        child.on("message", listen);
      });
    const ready = await receive("ready"),
      url = ready.base + "/api/v1/certificates/me";
    const sample = async () => {
      const promise = receive("sample");
      child.send("sample");
      return promise;
    };
    const h = headers(u),
      results = [];
    for (let i = 0; i < 5; i++) {
      const r = await fetch(url + "/" + id + "/pdf", { headers: h });
      if (r.status !== 200) throw Error("PDF warmup failed");
      await r.arrayBuffer();
    }
    for (const endpoint of ["pdf", "list"])
      for (const vus of [1, 2, 100, 200]) {
        const path = endpoint === "pdf" ? url + "/" + id + "/pdf" : url;
        const latencies = [],
          okLatencies = [];
        let errors = 0,
          busy = 0,
          ok = 0;
        await sample();
        const started = performance.now(),
          duration = Number(process.env.CERTIFICATE_PERF_STAGE_MS ?? 5000);
        await Promise.all(
          Array.from({ length: vus }, async (_, index) => {
            await new Promise((done) => setTimeout(done, (index * 1000) / vus));
            while (performance.now() - started < duration) {
              const start = performance.now();
              try {
                const response = await fetch(path, {
                  headers: h,
                  signal: AbortSignal.timeout(30000),
                });
                await response.arrayBuffer();
                const ms = performance.now() - start;
                latencies.push(ms);
                if (response.status === 503) busy++;
                else if (response.status === 200) {
                  ok++;
                  okLatencies.push(ms);
                } else errors++;
              } catch {
                errors++;
                latencies.push(performance.now() - start);
              }
            }
          }),
        );
        const elapsed = (performance.now() - started) / 1000,
          stats = await sample();
        latencies.sort((a, b) => a - b);
        okLatencies.sort((a, b) => a - b);
        const round = (n) => Math.round(n * 100) / 100;
        const result = {
          endpoint,
          vus,
          requests: latencies.length,
          ok,
          errors,
          busy,
          seconds: round(elapsed),
          p50: round(percentile(latencies, 0.5)),
          p95: round(percentile(latencies, 0.95)),
          p99: round(percentile(latencies, 0.99)),
          successP95: round(percentile(okLatencies, 0.95)),
          throughput: round(latencies.length / elapsed),
          successThroughput: round(ok / elapsed),
          busyRate: round((100 * busy) / latencies.length),
          rssMiB: round(stats.rssBytes / 1024 ** 2),
          cpuPercent: round(stats.cpuPercent),
        };
        results.push(result);
        console.log(JSON.stringify(result));
      }
    const report = {
      machine: {
        cpu: cpus()[0].model,
        logicalCpus: cpus().length,
        ramGiB: Math.round(totalmem() / 1024 ** 3),
        node: process.version,
        platform: process.platform,
        database: "PostgreSQL Docker on same host, loopback port 5433",
        storage: "in-memory PNG read with verified hash; frozen logo included",
        service:
          "separate Node process with real HTTP controller/guard/service/repository/renderer and PostgreSQL",
        load: "Node fetch client; 1-second VU ramp per stage; no think time; latency includes rejected requests and drain",
      },
      queue: { active: 1, waiting: 16, maxWaitMs: 1500, retryAfterSeconds: 1 },
      retainedSchema: f.schema,
      results,
    };
    writeFileSync(
      process.env.CERTIFICATE_PERF_OUTPUT,
      JSON.stringify(report, null, 2) + "\n",
    );
    const stopped = new Promise((done) => child.once("exit", done));
    child.send("stop");
    await stopped;
    console.log("Report saved; schema intentionally retained.");
  } catch (error) {
    child?.kill();
    throw error;
  } finally {
    await f.db.$disconnect().catch(() => {});
    await f.pool.end().catch(() => {});
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
