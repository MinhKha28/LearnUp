#!/usr/bin/env node
/**
 * Browser smoke for the demo journeys: the production frontend bundle (every VITE_*_BACKEND_URL
 * = the gateway) driven through headless Chromium over raw CDP, against the running E2E cluster.
 * Data is created under a run prefix and never deleted. Screenshots go to $E2E_STATE_DIR/ui-screens.
 * Exit code: 0 when every step passed, 1 otherwise.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GATEWAY, STATE_DIR } from "../lib/config.mjs";
import { seededOrganizers } from "../lib/actors.mjs";
import { Browser } from "./cdp.mjs";
import { KNOWN_BUGS } from "../lib/known-bugs.mjs";
import { serveStatic } from "./serve.mjs";
import { createLearner } from "./setup.mjs";
import { journeys } from "./journeys.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, "../../../frontend");
const dist = process.env.E2E_UI_DIST ?? path.join(STATE_DIR, "ui-dist");
const PORT = Number(process.env.E2E_UI_PORT ?? 3000);
const ORIGIN = `http://localhost:${PORT}`; // gateway CORS allows localhost:3000 / :5173
const only = process.argv.slice(2).filter((a) => /^S\d+$/i.test(a)).map((a) => a.toUpperCase());
const runId = `e2e${new Date().toISOString().replace(/\D/g, "").slice(2, 14)}`;

if (process.env.E2E_UI_REBUILD === "1" || !fs.existsSync(path.join(dist, "index.html"))) {
  if (!fs.existsSync(path.join(frontend, "node_modules"))) throw new Error("run `npm ci` in frontend/ first");
  console.log(`building frontend bundle -> ${dist} (all VITE_*_BACKEND_URL = ${GATEWAY})`);
  const env = { ...process.env };
  for (const k of ["VITE_BACKEND_URL", "VITE_TENANT_BACKEND_URL", "VITE_COURSE_BACKEND_URL", "VITE_ASSESSMENT_BACKEND_URL"]) env[k] = GATEWAY;
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: frontend, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error("frontend build failed");
}

console.log(`LearnUP E2E UI smoke, run ${runId}, frontend ${ORIGIN} -> gateway ${GATEWAY}`);
const organizers = await seededOrganizers();
const shared = { runId, origin: ORIGIN, organizer: organizers.a, screens: path.join(STATE_DIR, "ui-screens", runId) };
shared.learner = await createLearner(organizers.a, runId);
console.log(`learner ${shared.learner.email} created through the API (setup, not under test)`);

const server = await serveStatic(dist, PORT);
const browser = await Browser.launch();
const results = [];
try {
  for (const journey of journeys) {
    if (only.length && !only.includes(journey.id)) continue;
    const result = { id: journey.id, title: journey.title, steps: [], status: "PASS" };
    const started = Date.now();
    const page = await browser.newPage();
    let n = 0;
    const step = async (name, fn, { allow4xx = [], knownBug } = {}) => {
      const t0 = Date.now();
      const mark = { errors: page.errors.length, responses: page.responses.length, failures: page.failures.length };
      const label = `${journey.id}.${String(++n).padStart(2, "0")}`;
      let error = null;
      let value;
      try {
        value = await fn();
        await page.networkIdle();
        const bad = page.responses.slice(mark.responses).filter(
          (r) => r.status >= 500 || (r.status >= 400 && !allow4xx.some((a) => r.status === a)),
        );
        if (bad.length) throw new Error(`unexpected HTTP: ${bad.map((r) => `${r.status} ${r.method} ${r.url}`).join("; ")}`);
        const errs = page.errors.slice(mark.errors);
        if (errs.length) throw new Error(`uncaught page error: ${errs[0].split("\n")[0]}`);
      } catch (e) {
        error = String(e.message ?? e);
      }
      const shot = path.join(shared.screens, `${label}.png`);
      await page.screenshot(shot).catch(() => {});
      if (knownBug && !KNOWN_BUGS[knownBug]) throw new Error(`unknown bug id ${knownBug}`);
      const status = knownBug ? (error ? "KNOWN-FAIL" : "UNEXPECTED-PASS") : error ? "FAIL" : "PASS";
      const entry = { name, ms: Date.now() - t0, status, knownBug, screenshot: shot, ...(error && { error }) };
      result.steps.push(entry);
      console.log(`   ${status.padEnd(15)} ${label} ${name}${knownBug ? ` [${knownBug}]` : ""} (${entry.ms} ms)${error ? `\n         ${error.slice(0, 500)}` : ""}`);
      if (error) throw Object.assign(new Error(error), { stepFailed: true, knownBug });
      return value;
    };
    console.log(`\n${journey.id} ${journey.title}`);
    try {
      await journey.run({ page, step, shared });
    } catch (e) {
      result.status = e.knownBug ? "KNOWN-FAIL" : "FAIL";
      if (!e.stepFailed) console.log(`   journey error: ${e.stack}`);
    }
    result.ms = Date.now() - started;
    result.observations = page.observations ?? [];
    for (const o of result.observations) console.log(`   note: ${o}`);
    console.log(`${journey.id} ${result.status} (${result.ms} ms)`);
    results.push(result);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
fs.mkdirSync(path.join(STATE_DIR, "ui-runs"), { recursive: true });
fs.writeFileSync(path.join(STATE_DIR, "ui-runs", `${runId}.json`), JSON.stringify({ runId, learner: shared.learner.email, results }, null, 2));
const unexpected = results.flatMap((r) => r.steps.filter((x) => x.status === "UNEXPECTED-PASS").map((x) => `${r.id}: ${x.name} [${x.knownBug}]`));
if (unexpected.length) console.log(`\nKnown-bug steps that passed (bug fixed? update known-bugs.mjs):\n   ${unexpected.join("\n   ")}`);
const known = new Set(results.flatMap((r) => r.steps.filter((x) => x.status === "KNOWN-FAIL").map((x) => x.knownBug)));
for (const id of known) console.log(`\nKnown failure ${id}: ${KNOWN_BUGS[id]}`);
const ok = results.every((r) => r.status === "PASS" || r.status === "KNOWN-FAIL");
console.log(`\nScreenshots: ${shared.screens}\nRESULT: ${ok ? "OK" : "FAILED"}`);
process.exit(ok ? 0 : 1);
