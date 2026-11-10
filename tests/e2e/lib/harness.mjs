import assert from "node:assert/strict";
import { KNOWN_BUGS } from "./known-bugs.mjs";

export class SkipJourney extends Error {}

/** Runs one journey: steps run in order and the first unexpected failure stops the journey. */
export async function runJourney(journey, shared) {
  const result = { id: journey.id, title: journey.title, services: journey.services, steps: [], status: "PASS" };
  const started = Date.now();
  const step = async (name, fn, { knownBug } = {}) => {
    const t0 = Date.now();
    try {
      const value = await fn();
      result.steps.push({ name, status: knownBug ? "UNEXPECTED-PASS" : "PASS", knownBug, ms: Date.now() - t0 });
      return value;
    } catch (error) {
      if (error instanceof SkipJourney) throw error;
      const entry = { name, ms: Date.now() - t0, error: String(error?.message ?? error).slice(0, 600) };
      if (knownBug) {
        if (!KNOWN_BUGS[knownBug]) throw new Error(`unknown bug id ${knownBug}`);
        result.steps.push({ ...entry, status: "KNOWN-FAIL", knownBug });
        if (result.status === "PASS") result.status = "KNOWN-FAIL";
        return undefined;
      }
      result.steps.push({ ...entry, status: "FAIL" });
      throw Object.assign(new Error(entry.error), { stepFailed: true });
    }
  };
  try {
    await journey.run({ step, shared, skip: (why) => { throw new SkipJourney(why); } });
  } catch (error) {
    if (error instanceof SkipJourney) {
      result.status = "SKIP";
      result.reason = error.message;
    } else {
      result.status = "FAIL";
      if (!error.stepFailed) result.steps.push({ name: "(journey)", status: "FAIL", error: String(error?.stack ?? error).slice(0, 600) });
    }
  }
  result.ms = Date.now() - started;
  return result;
}

/** Asserts an HTTP status and returns the response, with the body in the failure message. */
export function expectStatus(res, expected, what = "") {
  const list = Array.isArray(expected) ? expected : [expected];
  assert.ok(
    list.includes(res.status),
    `${what} expected HTTP ${list.join("/")}, got ${res.status}: ${JSON.stringify(res.body).slice(0, 400)}`,
  );
  return res;
}

export { assert };
