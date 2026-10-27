#!/usr/bin/env node
/**
 * Explicit cleanup for data created by run.mjs. Never called by the suite.
 *
 *   node tests/e2e/cleanup.mjs --run <runId>|--all          dry run: lists what would change
 *   node tests/e2e/cleanup.mjs --run <runId>|--all --yes    applies it
 *
 * Uses business APIs only: learners withdraw their still-active Optional enrollments and the
 * organizer exempts Required ones (learning-service only exempts InProgress assignments, so a
 * NotStarted one is reported and left). No public API deletes accounts, credentials, Kafka events
 * or signer history, so those remain; resetting everything is a manual step in README.md.
 */
import fs from "node:fs";
import path from "node:path";
import { GATEWAY, STATE_DIR } from "./lib/config.mjs";
import { login, seededOrganizers } from "./lib/actors.mjs";
import { data, request } from "./lib/http.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--yes");
const runArg = args.includes("--all") ? null : args[args.indexOf("--run") + 1];
if (!args.includes("--all") && (!args.includes("--run") || !runArg)) {
  console.error("usage: node tests/e2e/cleanup.mjs --run <runId>|--all [--yes]");
  process.exit(2);
}
const runsDir = path.join(STATE_DIR, "runs");
const records = fs
  .readdirSync(runsDir)
  .filter((f) => f.endsWith(".json") && (!runArg || f === `${runArg}.json`))
  .map((f) => JSON.parse(fs.readFileSync(path.join(runsDir, f), "utf8")));
if (!records.length) {
  console.error(`no run record found in ${runsDir}`);
  process.exit(2);
}

const { a } = await seededOrganizers();
for (const record of records) {
  console.log(`run ${record.runId}`);
  const password = `E2e-${record.runId}-Pw1!`;
  const tokens = new Map();
  for (const learner of record.created.learners) {
    try {
      tokens.set(learner.id, await login(learner.email, password));
    } catch {
      console.log(`  learner ${learner.email}: cannot log in (never activated), account stays Pending`);
    }
  }
  for (const e of record.created.enrollments) {
    const token = tokens.get(e.learnerId);
    if (!token) continue;
    const refs = data(await request("GET", `${GATEWAY}/api/v1/enrollments/me/course-ids`, { token })) ?? [];
    const ref = refs.find((r) => r.enrollmentId === e.id);
    if (!ref || ["Withdrawn", "Exempted", "Completed"].includes(ref.status)) {
      console.log(`  enrollment ${e.id}: nothing to do (${ref?.status ?? "not active"})`);
      continue;
    }
    const action = e.type === "Optional" ? "withdraw (learner)" : "exempt (organizer)";
    if (!apply) {
      console.log(`  enrollment ${e.id} ${ref.status}: would ${action}`);
      continue;
    }
    const res =
      e.type === "Optional"
        ? await request("POST", `${GATEWAY}/api/v1/enrollments/${e.id}/withdrawal`, { token })
        : await request("POST", `${GATEWAY}/api/v1/assignments/${e.id}/exemption`, {
            token: a.token,
            json: { reason: `E2E cleanup ${record.runId}` },
          });
    const code = res.body?.error?.code ? ` ${res.body.error.code}` : "";
    console.log(`  enrollment ${e.id}: ${action} -> HTTP ${res.status}${code}`);
  }
}
if (!apply) console.log("dry run only; re-run with --yes to apply");
