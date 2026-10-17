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
fs.writeFileSync(
  path.join(dir, `${label}-report.json`),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
