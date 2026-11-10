import { performance } from "node:perf_hooks";

/** Per-route latency samples (ms), keyed by "METHOD label". Shared by the whole process. */
export const latency = new Map();
/** Per-journey latency samples (ms) of every request issued while that journey runs. */
export const journeyLatency = new Map();
let currentJourney = null;
export const setJourney = (id) => {
  currentJourney = id;
};

/**
 * Minimal HTTP client over fetch. `label` is the route template used for latency stats,
 * e.g. "GET /api/v1/enrollments/:id/curriculum". Never throws on HTTP status.
 */
export async function request(method, url, { token, headers = {}, json, form, label } = {}) {
  const init = { method, headers: { ...headers }, redirect: "manual" };
  if (token) init.headers.authorization = `Bearer ${token}`;
  if (json !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (form) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.append(k, v);
    init.body = fd;
  }
  const started = performance.now();
  const res = await fetch(url, init);
  const text = await res.text();
  const ms = performance.now() - started;
  const key = `${method} ${label ?? new URL(url).pathname}`;
  if (!latency.has(key)) latency.set(key, []);
  latency.get(key).push(ms);
  if (currentJourney) {
    if (!journeyLatency.has(currentJourney)) journeyLatency.set(currentJourney, []);
    journeyLatency.get(currentJourney).push(ms);
  }
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  return { status: res.status, headers: res.headers, body, ms };
}

export function percentile(samples, p) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

/** Unwraps the `{ statusCode, message, data }` / `{ success, data }` envelopes used across services. */
export const data = (res) => (res.body && typeof res.body === "object" && "data" in res.body ? res.body.data : res.body);
