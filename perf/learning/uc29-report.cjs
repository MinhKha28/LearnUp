const fs = require("node:fs");
const dir = "perf/learning/results";
const rows = [];
for (const vus of [1, 2, 100, 200, 1000, 2000])
  for (let run = 1; run <= 3; run++) {
    const file = `${dir}/uc29-${vus}-${run}.json`;
    if (!fs.existsSync(file)) continue;
    const summary = JSON.parse(fs.readFileSync(file));
    const m = summary.metrics;
    const v = (name) => m[`${name}{phase:steady}`]?.values;
    const latency = v("http_req_duration");
    if (!latency) continue;
    const samples = JSON.parse(
      fs.readFileSync(`${dir}/uc29-${vus}-${run}-resources.json`),
    );
    const resource = (name) => {
      const values = samples
        .flatMap((s) => s.containers)
        .filter((c) => c.Name === name);
      const cpu = values.map((c) => parseFloat(c.CPUPerc));
      const memory = values.map((c) => {
        const match = c.MemUsage.match(/([\d.]+)([KMG]iB)/);
        return (
          Number(match[1]) * { KiB: 1 / 1024, MiB: 1, GiB: 1024 }[match[2]]
        );
      });
      return { cpuPeak: Math.max(...cpu), ramPeakMiB: Math.max(...memory) };
    };
    rows.push({
      vus,
      run,
      p50: latency.med,
      p95: latency["p(95)"],
      p99: latency["p(99)"],
      rps: v("http_reqs").count / 60,
      errors: v("http_req_failed").rate,
      timeouts: v("access_timeouts").rate,
      checks: v("checks").rate,
      learning: resource("learnup-l17-learning-ready"),
      postgres: resource("learnup-l6-postgres"),
    });
  }
const fmt = (n) => Number(n).toFixed(2);
console.log(
  "| VUs | Run | p50 ms | p95 ms | p99 ms | req/s | HTTP errors % | Timeouts % | Learning CPU peak % / RAM MiB | PostgreSQL CPU peak % / RAM MiB |",
);
console.log("|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const r of rows)
  console.log(
    `| ${r.vus} | ${r.run} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.p99)} | ${fmt(r.rps)} | ${fmt(r.errors * 100)} | ${fmt(r.timeouts * 100)} | ${fmt(r.learning.cpuPeak)} / ${fmt(r.learning.ramPeakMiB)} | ${fmt(r.postgres.cpuPeak)} / ${fmt(r.postgres.ramPeakMiB)} |`,
  );
fs.writeFileSync(`${dir}/uc29-report.json`, JSON.stringify(rows, null, 2));
