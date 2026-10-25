import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

const owner = { userId: "synthetic-a", organizationId: "synthetic-org" };
const jwt = (sub = owner.userId, version = 1) => `h.${btoa(JSON.stringify({ sub, organizationId: owner.organizationId, exp: 9_999_999_999, version }))}.s`;
const report = { ranges: [[0, 15]] as [number, number][], positionSeconds: 15, reportedAt: "2026-10-23T00:00:00Z" };
let server: Server;
let learning: typeof import("./learning.service");
const stored = new Map<string, string>();
const requests: { url?: string; authorization?: string; body: unknown }[] = [];
let mode: "refresh" | "switch-user" | "still-401" | "422" = "refresh";
const reply = (response: ServerResponse, status: number, data: unknown) => {
  response.writeHead(status, { "Content-Type": "application/json", "X-Correlation-ID": "synthetic-correlation" });
  response.end(JSON.stringify(data));
};
beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      requests.push({ url: req.url, authorization: req.headers.authorization, body: raw ? JSON.parse(raw) : undefined });
      if (req.url?.endsWith("/refresh")) {
        if (mode === "switch-user") stored.set("access_token", jwt("synthetic-b"));
        reply(res, 200, { data: { accessToken: jwt(owner.userId, 2), refreshToken: "synthetic-rotated" } });
      } else if (mode === "422") reply(res, 422, { error: { code: "VALIDATION_ERROR" } });
      else if (req.headers.authorization === `Bearer ${jwt(owner.userId, 2)}` && mode !== "still-401") reply(res, 200, { data: { watchedSeconds: 15 } });
      else reply(res, 401, { error: { code: "UNAUTHORIZED" } });
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  vi.stubEnv("VITE_BACKEND_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); },
    removeItem: (key: string) => { stored.delete(key); },
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn(), location: { pathname: "/learner", search: "", assign: vi.fn() } });
  learning = await import("./learning.service");
});
beforeEach(() => {
  requests.length = 0; stored.clear(); mode = "refresh";
  stored.set("access_token", jwt()); stored.set("refresh_token", "synthetic-refresh");
});
afterEach(() => vi.useRealTimers());
afterAll(async () => {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
it("B uses real Axios interceptors for HTTP401 → refresh → identical replay", async () => {
  await expect(learning.reportVideoProgress("e", "m", report, false, owner)).resolves.toMatchObject({ watchedSeconds: 15 });
  expect(requests.map(r => r.url)).toEqual(["/api/v1/enrollments/e/materials/m/progress", "/api/v1/auth/refresh", "/api/v1/enrollments/e/materials/m/progress"]);
  expect(requests[0].body).toEqual(report); expect(requests[2].body).toEqual(report);
  expect(requests[2].authorization).toBe(`Bearer ${jwt(owner.userId, 2)}`);
});
it("Reading sends no business payload and replays safely through the existing refresh interceptor", async () => {
  await learning.completeReading("e", "reading", owner);
  expect(requests.map(r => r.url)).toEqual(["/api/v1/enrollments/e/materials/reading/complete-reading", "/api/v1/auth/refresh", "/api/v1/enrollments/e/materials/reading/complete-reading"]);
  expect(requests[0].body).toBeUndefined(); expect(requests[2].body).toBeUndefined();
  expect(requests[2].authorization).toBe(`Bearer ${jwt(owner.userId, 2)}`);
});
it("Reading cannot replay completion after the account changes during refresh", async () => {
  mode = "switch-user";
  await expect(learning.completeReading("e", "reading", owner)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(requests).toHaveLength(2);
});
it("does not replay A's progress using B's token after refresh", async () => {
  mode = "switch-user";
  await expect(learning.reportVideoProgress("e", "m", report, false, owner)).rejects.toMatchObject({ status: 401 });
  expect(requests).toHaveLength(2);
  expect(stored.get("access_token")).toBe(jwt("synthetic-b"));
});
it("does not start B when the current token belongs to another user", async () => {
  stored.set("access_token", jwt("synthetic-b"));
  await expect(learning.reportVideoProgress("e", "m", report, false, owner)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(requests).toHaveLength(0);
});
it("returns the second HTTP401 without an infinite refresh loop", async () => {
  mode = "still-401";
  await expect(learning.reportVideoProgress("e", "m", report, false, owner)).rejects.toMatchObject({ status: 401 });
  expect(requests).toHaveLength(3);
});
it("preserves X-Correlation-ID on Axios validation failure", async () => {
  mode = "422";
  await expect(learning.reportVideoProgress("e", "m", report, false, owner)).rejects.toMatchObject({ status: 422, details: { correlationId: "synthetic-correlation" } });
});
it("uses fetch keepalive with the current token and a 10-second AbortSignal", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const original = globalThis.fetch;
  globalThis.fetch = fetchMock as typeof fetch;
  try {
    const pending = learning.reportVideoProgress("e", "m", report, true, owner);
    const assertion = expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(10_000); await assertion;
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ keepalive: true, headers: { Authorization: `Bearer ${jwt()}` } });
    expect(requests).toHaveLength(0);
  } finally { globalThis.fetch = original; }
});
