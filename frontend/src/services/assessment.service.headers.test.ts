// @vitest-environment jsdom
// What the browser really sends from the assessment service: the real Axios client with its interceptors, and the network
// replaced by a recorder. assessment.service.test.ts mocks the client, so it cannot see what the interceptor adds.
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** The identity belongs to the gateway (from the JWT): the browser sends only its token in Authorization. */
const IDENTITY_HEADERS = ["x-internal-key", "x-user-id", "x-organization-id", "x-user-role", "x-dev-user-id"];

let service: typeof import("./assessment.service");
const seen: { headers: Record<string, unknown> }[] = [];

beforeAll(async () => {
  for (const name of [
    "VITE_BACKEND_URL",
    "VITE_TENANT_BACKEND_URL",
    "VITE_COURSE_BACKEND_URL",
    "VITE_ASSESSMENT_BACKEND_URL",
  ])
    vi.stubEnv(name, "http://gateway.test");
  // The DEV-only sender of x-dev-user-id (VITE_DEV_FAKE_USER_ID) is tracked apart (issue #161); here it is off.
  vi.stubEnv("VITE_DEV_FAKE_USER_ID", "");
  localStorage.setItem("access_token", "test-token");

  const { assessmentAxios } = await import("./axios.customize");
  assessmentAxios.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    seen.push({ headers: AxiosHeaders.from(config.headers).toJSON() as Record<string, unknown> });
    // src/types/axios.d.ts types AxiosResponse as a Promise (the response interceptor unwraps it): a plain object needs the cast
    return { data: {}, status: 200, statusText: "OK", headers: {}, config } as unknown as AxiosResponse;
  };
  service = await import("./assessment.service");
});
afterAll(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe("what the assessment client sends, interceptors included", () => {
  it("sends the token of the user and none of the internal or identity headers, from any of its calls", async () => {
    const calls = Object.entries(service).filter(
      (entry): entry is [string, (...args: unknown[]) => unknown] =>
        entry[0].endsWith("API") && typeof entry[1] === "function",
    );
    expect(calls.length).toBeGreaterThan(15); // the guard sees the whole service, not an empty list
    for (const [, call] of calls) {
      try {
        await call("id-1", "id-2", "id-3");
      } catch {
        // some calls need real arguments (a file, a payload); what they sent before that is still checked
      }
    }
    expect(seen.length).toBeGreaterThan(15);
    for (const { headers } of seen) {
      const names = Object.keys(headers).map((name) => name.toLowerCase());
      for (const forbidden of IDENTITY_HEADERS) expect(names).not.toContain(forbidden);
      // the interceptor did run: the one credential the browser sends is the token of the user
      expect(headers.Authorization ?? headers.authorization).toBe("Bearer test-token");
    }
  });
});
