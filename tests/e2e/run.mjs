#!/usr/bin/env node
/**
 * Runs the cross-service API journeys once against a running cluster (see README.md).
 * Every run creates its own data under a unique run prefix and never deletes anything;
 * created IDs are recorded in $E2E_STATE_DIR/runs/<runId>.json for the separate cleanup command.
 * Exit code: 0 when every journey is PASS or KNOWN-FAIL, 1 otherwise.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STATE_DIR } from "./lib/config.mjs";
import { seededOrganizers } from "./lib/actors.mjs";
import { runJourney } from "./lib/harness.mjs";
import { journeyLatency, latency, percentile, setJourney } from "./lib/http.mjs";
import { KNOWN_BUGS } from "./lib/known-bugs.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "journeys");
const only = process.argv.slice(2).filter((a) => /^J\d+$/i.test(a)).map((a) => a.toUpperCase());
const runId = `e2e${new Date().toISOString().replace(/\D/g, "").slice(2, 14)}`;
const shared = { runId, created: { learners: [], enrollments: [] } };

const runsDir = path.join(STATE_DIR, "runs");
fs.mkdirSync(runsDir, { recursive: true });
const recordFile = path.join(runsDir, `${runId}.json`);
const save = (extra = {}) =>
  fs.writeFileSync(recordFile, JSON.stringify({ runId, startedAt, created: shared.created, ...extra }, null, 2));
const startedAt = new Date().toISOString();

console.log(`LearnUP E2E API journeys, run ${runId}`);
shared.organizers = await seededOrganizers();

const results = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".mjs")).sort()) {
  const journey = (await import(path.join(dir, file))).default;
  if (only.length && !only.includes(journey.id)) continue;
  setJourney(journey.id);
  const result = await runJourney(journey, shared);
  setJourney(null);
  const samples = journeyLatency.get(journey.id) ?? [];
  Object.assign(result, { requests: samples.length, p50: percentile(samples, 50), p95: percentile(samples, 95), samples });
  results.push(result);
  save({ results });
  const lat = result.requests ? `, ${result.requests} req p50 ${result.p50.toFixed(1)} / p95 ${result.p95.toFixed(1)} ms` : "";
  console.log(`\n${result.id} ${result.status.padEnd(10)} ${result.title} (${result.ms} ms${lat})${result.reason ? ` - ${result.reason}` : ""}`);
  for (const s of result.steps) {
    const tag = s.knownBug ? ` [${s.knownBug}]` : "";
    console.log(`   ${s.status.padEnd(15)} ${s.name}${tag}${s.error ? `\n${" ".repeat(19)}${s.error}` : ""}`);
  }
}

const stats = [...latency.entries()]
  .map(([route, samples]) => ({ route, n: samples.length, p50: percentile(samples, 50), p95: percentile(samples, 95) }))
  .sort((x, y) => x.route.localeCompare(y.route));
console.log("\nPer-request latency (single-user, 4 vCPU/16 GB, not a load test)");
for (const s of stats) console.log(`   ${s.p50.toFixed(1).padStart(7)} ${s.p95.toFixed(1).padStart(7)} ms  n=${String(s.n).padStart(2)}  ${s.route}`);

const known = new Set(results.flatMap((r) => r.steps.filter((s) => s.status === "KNOWN-FAIL").map((s) => s.knownBug)));
if (known.size) {
  console.log("\nKnown failures (product bugs, see README.md#known-failures):");
  for (const id of known) console.log(`   ${id}: ${KNOWN_BUGS[id]}`);
}
const unexpected = results.flatMap((r) => r.steps.filter((s) => s.status === "UNEXPECTED-PASS").map((s) => `${r.id}: ${s.name} [${s.knownBug}]`));
if (unexpected.length) console.log(`\nKnown-bug steps that passed (bug fixed? update known-bugs.mjs):\n   ${unexpected.join("\n   ")}`);

save({ results, latency: stats, finishedAt: new Date().toISOString() });
console.log(`\nRecord: ${recordFile}`);
const ok = results.every((r) => r.status === "PASS" || r.status === "KNOWN-FAIL");
console.log(ok ? "RESULT: OK (no unexpected failures)" : "RESULT: FAILED");
process.exit(ok ? 0 : 1);
