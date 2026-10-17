const fs = require("node:fs");
const path = require("node:path");
const label = process.argv[2];
if (!/^[a-zA-Z0-9-]+$/.test(label || "")) throw new Error("Invalid label");
const dir = path.join(__dirname, "results");
const summary = JSON.parse(
  fs.readFileSync(path.join(dir, `${label}-summary.json`)),
);
const counts = {};
for (const line of fs
  .readFileSync(path.join(dir, `${label}-samples.json`), "utf8")
  .split("\n")) {
  if (!line) continue;
  const point = JSON.parse(line);
  if (point.type === "Point" && point.metric === "http_status") {
    const status = point.data.tags.status;
    counts[status] = (counts[status] || 0) + point.data.value;
  }
}
const metrics = summary.metrics;
const result = {
  label,
  latency_ms: metrics.enrollment_duration.values,
  http: counts,
  server_errors: metrics.server_errors.values.count,
  timeouts: metrics.timeouts.values.count,
  network_errors: counts["0"] || 0,
  unexpected_response_rate: metrics.unexpected_responses.values.rate,
  http_failure_rate: metrics.http_req_failed.values.rate,
  requests_per_second: metrics.http_reqs.values.rate,
  dropped_iterations: metrics.dropped_iterations?.values.count || 0,
  errors: Math.round(
    metrics.unexpected_responses.values.rate * metrics.http_reqs.values.count,
  ),
  connection_ms: metrics.http_req_connecting.values,
  blocked_ms: metrics.http_req_blocked.values,
  iteration_ms: metrics.iteration_duration.values,
  course_calls: JSON.parse(
    fs
      .readFileSync(path.join(dir, `${label}-course-calls.json`), "utf8")
      .replace(/^\uFEFF/, ""),
  ),
  sql: JSON.parse(fs.readFileSync(path.join(dir, `${label}-sql.json`))),
};
const activity = JSON.parse(
  fs.readFileSync(path.join(dir, `${label}-pg-activity.json`)),
);
result.pg_max = {};
for (const db of ["learning_db", "course_db"]) {
  result.pg_max[db] = { connections: 0, lock_tuple: 0, lock_wait: 0 };
  for (const sample of activity) {
    const rows = sample.activity.filter((r) => r.datname === db);
    for (const [key, filter] of [
      ["connections", () => true],
      [
        "lock_tuple",
        (r) => r.wait_event_type === "Lock" && r.wait_event === "tuple",
      ],
      ["lock_wait", (r) => r.wait_event_type === "Lock"],
    ]) {
      result.pg_max[db][key] = Math.max(
        result.pg_max[db][key],
        rows.filter(filter).reduce((sum, r) => sum + r.connections, 0),
      );
    }
  }
}
const poolPath = path.join(dir, `${label}-learning-pool.json`);
result.learning_pool = fs.existsSync(poolPath)
  ? JSON.parse(fs.readFileSync(poolPath, "utf8").replace(/^\uFEFF/, ""))
  : { available: false };
result.resources = {};
const statsPath = path.join(dir, `${label}-docker-stats.txt`);
if (fs.existsSync(statsPath)) {
  const lines = fs
    .readFileSync(statsPath, "utf8")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim().startsWith("{")) continue;
    const sample = JSON.parse(line);
    const cpu = Number.parseFloat(sample.CPUPerc);
    const item = (result.resources[sample.Name] ||= {
      samples: 0,
      cpu_max_percent: 0,
      cpu_mean_percent: 0,
      memory_last: null,
    });
    item.samples++;
    item.cpu_mean_percent += (cpu - item.cpu_mean_percent) / item.samples;
    item.cpu_max_percent = Math.max(item.cpu_max_percent, cpu);
    item.memory_last = sample.MemUsage;
  }
}
fs.writeFileSync(
  path.join(dir, `${label}-report.json`),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
