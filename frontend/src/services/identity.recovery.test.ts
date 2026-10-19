import { createServer, type IncomingHttpHeaders, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type {} from "@/types/global";
import axiosLibrary, { type AxiosAdapter, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type RecoveryAction = "forgot" | "reset";
type WireRequest = {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
  payload: unknown;
};
type ObservedConfig = {
  timeout: number | undefined;
  responseType: string | undefined;
  withCredentials: boolean | undefined;
  acceptsErrorStatus: boolean;
};

const EMAIL = "synthetic-recovery@example.test";
const RESET_TOKEN = "synthetic-private-reset-token";
const PASSWORD = "SyntheticRecoveryPassword123!";
const ACCESS = "synthetic-existing-access-token";
const REFRESH = "synthetic-existing-refresh-token";
const INVALID_TOKEN_MESSAGE = "Invalid, expired, or already used password reset token";
const SUCCESS = { success: true, data: { message: "Synthetic successful operation" } };

describe("Identity recovery requests with the real shared Axios interceptors", () => {
  let server: Server;
  let baseUrl: string;
  let shared: AxiosInstance;
  let originalAdapter: AxiosInstance["defaults"]["adapter"];
  let originalCommonHeaders: AxiosInstance["defaults"]["headers"]["common"];
  let identity: typeof import("@/services/identity.service");
  let session: typeof import("@/services/auth.session");
  let handler: (request: WireRequest, response: ServerResponse) => void;
  const requests: WireRequest[] = [];
  const observed: ObservedConfig[] = [];
  const stored = new Map<string, string>();
  const assign = vi.fn();
  const storage: Storage = {
    get length() { return stored.size; },
    getItem: vi.fn((key: string) => stored.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stored.set(key, value); }),
    removeItem: vi.fn((key: string) => { stored.delete(key); }),
    clear: vi.fn(() => { stored.clear(); }),
    key: vi.fn((index: number) => [...stored.keys()][index] ?? null),
  };

  beforeAll(async () => {
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => { chunks.push(chunk); });
      request.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let payload: unknown = null;
        if (raw) {
          try { payload = JSON.parse(raw); } catch { payload = raw; }
        }
        const captured: WireRequest = { method: request.method, url: request.url, headers: request.headers, payload };
        requests.push(captured);
        handler(captured, response);
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for (const name of ["VITE_BACKEND_URL", "VITE_TENANT_BACKEND_URL", "VITE_COURSE_BACKEND_URL", "VITE_ASSESSMENT_BACKEND_URL"]) {
      vi.stubEnv(name, baseUrl);
    }
    vi.stubEnv("VITE_DEV_FAKE_USER_ID", "synthetic-dev-user-context");
    vi.stubEnv("DEV", true);
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { location: { pathname: "/learner", search: "", assign } });
    // Import after the complete env contract is configured. No app module or interceptor is mocked.
    identity = await import("@/services/identity.service");
    session = await import("@/services/auth.session");
    shared = (await import("@/services/axios.customize")).default;
    originalAdapter = shared.defaults.adapter;
    originalCommonHeaders = { ...shared.defaults.headers.common };
    const realHttpAdapter: AxiosAdapter = axiosLibrary.getAdapter(originalAdapter);
    shared.defaults.adapter = (config: InternalAxiosRequestConfig) => {
      observed.push({
        timeout: config.timeout,
        responseType: config.responseType,
        withCredentials: config.withCredentials,
        acceptsErrorStatus: config.validateStatus?.(401) === true && config.validateStatus?.(503) === true,
      });
      return realHttpAdapter(config);
    };
  });

  beforeEach(() => {
    requests.length = 0;
    observed.length = 0;
    stored.clear();
    stored.set("access_token", ACCESS);
    stored.set("refresh_token", REFRESH);
    vi.clearAllMocks();
    handler = (_request, response) => respond(response, 200, SUCCESS);
  });

  afterEach(() => {
    shared.defaults.headers.common = { ...originalCommonHeaders };
  });

  afterAll(async () => {
    if (shared) shared.defaults.adapter = originalAdapter;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((failure) => failure ? reject(failure) : resolve()));
    }
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const recover = (action: RecoveryAction) => action === "forgot"
    ? identity.forgotPasswordAPI({ email: EMAIL })
    : identity.resetPasswordAPI({ token: RESET_TOKEN, newPassword: PASSWORD, confirmPassword: PASSWORD });

  const expectUnchangedSession = () => {
    expect(stored.get("access_token")).toBe(ACCESS);
    expect(stored.get("refresh_token")).toBe(REFRESH);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  };

  const expectPublicWire = (request: WireRequest) => {
    for (const header of ["authorization", "x-internal-key", "x-user-id", "x-organization-id", "x-user-role", "x-dev-user-id"]) {
      expect(request.headers[header], `${header} must never reach a public recovery endpoint`).toBeUndefined();
    }
    expect(request.headers["content-type"]).toContain("application/json");
  };

  it("posts only email to the actual forgot endpoint without stored or accidental identity credentials", async () => {
    Object.assign(shared.defaults.headers.common, {
      "X-Internal-Key": "synthetic-accidental-service-credential",
      "X-User-ID": "synthetic-accidental-user-id",
      "X-Organization-ID": "synthetic-accidental-organization-id",
      "X-User-Role": "ADMIN",
    });

    expect(await recover("forgot")).toEqual({ success: true });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "POST", url: "/api/v1/auth/forgot-password", payload: { email: EMAIL } });
    expectPublicWire(requests[0]);
    expect(observed).toEqual([{ timeout: 10000, responseType: "text", withCredentials: false, acceptsErrorStatus: true }]);
    expectUnchangedSession();
  });

  it("posts the opaque reset token and both password fields in JSON, never in the request URL", async () => {
    expect(await recover("reset")).toEqual({ success: true });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "POST", url: "/api/v1/auth/reset-password",
      payload: { token: RESET_TOKEN, newPassword: PASSWORD, confirmPassword: PASSWORD } });
    expect(requests[0].url).not.toContain(RESET_TOKEN);
    expectPublicWire(requests[0]);
    expect(observed).toEqual([{ timeout: 10000, responseType: "text", withCredentials: false, acceptsErrorStatus: true }]);
    expectUnchangedSession();
  });

  it.each<RecoveryAction>(["forgot", "reset"])("does not refresh, replay, clear tokens or redirect a signed-in %s request after HTTP401", async (action) => {
    handler = (_request, response) => respond(response, 401, { success: false,
      error: { code: "UNAUTHORIZED", message: RESET_TOKEN, details: [PASSWORD] } });

    expect(await recover(action)).toEqual({ success: false, error: "unavailable" });

    expect(requests).toHaveLength(1);
    expect(requests.some((request) => request.url === "/api/v1/auth/refresh")).toBe(false);
    expectPublicWire(requests[0]);
    expectUnchangedSession();
  });

  it.each([201, 202])("accepts a valid successful envelope only within the HTTP2xx range (%i)", async (status) => {
    handler = (_request, response) => respond(response, status, SUCCESS);

    expect(await recover("forgot")).toEqual({ success: true });
    expectUnchangedSession();
  });

  it.each([
    [400, SUCCESS],
    [401, SUCCESS],
    [403, SUCCESS],
    [429, SUCCESS],
    [503, SUCCESS],
    [200, { success: false, data: { message: "Not successful" } }],
    [200, { data: { message: "Missing success flag" } }],
    [200, { success: "true", data: { message: "Wrong success flag type" } }],
    [200, { success: true }],
    [200, { success: true, data: { message: "" } }],
    [200, { success: true, data: { message: "   " } }],
    [200, { success: true, data: { message: 123 } }],
    [200, { success: true, data: { message: "Conflicting success" }, error: { code: "BAD_REQUEST", message: RESET_TOKEN } }],
    [200, { success: true, message: "Wrong response structure" }],
    [200, null],
    [200, []],
    [200, "not-json-response"],
  ])("does not mistake status %i with malformed/conflicting envelope %# for confirmed recovery", async (status, body) => {
    handler = (_request, response) => respond(response, status as number, body);

    expect(await recover("forgot")).toEqual({ success: false, error: "unavailable" });
    expectUnchangedSession();
  });

  it("recognizes only the exact HTTP400 reset-token business failure", async () => {
    handler = (_request, response) => respond(response, 400,
      { success: false, error: { code: "BAD_REQUEST", message: INVALID_TOKEN_MESSAGE } });

    expect(await recover("reset")).toEqual({ success: false, error: "invalid-token" });
    expectUnchangedSession();
  });

  it.each([
    [400, "VALIDATION_ERROR", INVALID_TOKEN_MESSAGE],
    [400, "BAD_REQUEST", "New password and confirmation password do not match"],
    [400, "BAD_REQUEST", `${INVALID_TOKEN_MESSAGE}: ${RESET_TOKEN}`],
    [401, "BAD_REQUEST", INVALID_TOKEN_MESSAGE],
    [503, "BAD_REQUEST", INVALID_TOKEN_MESSAGE],
  ])("does not mislabel status %i / code %s / response %# as an invalid link", async (status, code, message) => {
    handler = (_request, response) => respond(response, status as number,
      { success: false, error: { code, message } });

    expect(await recover("reset")).toEqual({ success: false, error: "unavailable" });
    expectUnchangedSession();
  });

  it("never returns an invalid-token outcome from the forgot endpoint", async () => {
    handler = (_request, response) => respond(response, 400,
      { success: false, error: { code: "BAD_REQUEST", message: INVALID_TOKEN_MESSAGE } });

    expect(await recover("forgot")).toEqual({ success: false, error: "unavailable" });
  });

  it.each<RecoveryAction>(["forgot", "reset"])("converts a %s transport failure into a secret-free result", async (action) => {
    handler = (_request, response) => response.destroy();

    const result = await recover(action);

    expect(result).toEqual({ success: false, error: "unavailable" });
    expect(JSON.stringify(result)).not.toContain(RESET_TOKEN);
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
    expectUnchangedSession();
  });

  it("does not change the existing login request or response-interceptor contract", async () => {
    handler = (_request, response) => respond(response, 200, {
      success: true, data: { accessToken: "synthetic-login-access", refreshToken: "synthetic-login-refresh" },
    });

    const result = await identity.loginAPI(EMAIL, PASSWORD);

    expect(result).toMatchObject({ success: true, data: { accessToken: "synthetic-login-access", refreshToken: "synthetic-login-refresh" } });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "POST", url: "/api/v1/auth/login", payload: { username: EMAIL, password: PASSWORD } });
    expect(requests[0].headers.authorization).toBe(`Bearer ${ACCESS}`);
    expect(requests[0].headers["x-dev-user-id"]).toBe("synthetic-dev-user-context");
    expectUnchangedSession();
  });

  it("keeps the existing explicit refresh contract and token rotation working", async () => {
    handler = (_request, response) => respond(response, 200, {
      success: true, data: { accessToken: "synthetic-rotated-access", refreshToken: "synthetic-rotated-refresh" },
    });

    expect(await session.refreshAccessToken()).toBe("synthetic-rotated-access");

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: REFRESH } });
    expect(requests[0].headers.authorization).toBeUndefined();
    expect(stored.get("access_token")).toBe("synthetic-rotated-access");
    expect(stored.get("refresh_token")).toBe("synthetic-rotated-refresh");
    expect(assign).not.toHaveBeenCalled();
  });

  it("retains the normal protected-request HTTP401 refresh-and-retry behavior", async () => {
    handler = (request, response) => {
      if (request.url === "/api/v1/auth/refresh") {
        respond(response, 200, { success: true, data: { accessToken: "synthetic-retried-access", refreshToken: "synthetic-retried-refresh" } });
      } else if (request.headers.authorization === "Bearer synthetic-retried-access") {
        respond(response, 200, { success: true, data: { id: "synthetic-user-id" } });
      } else {
        respond(response, 401, { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      }
    };

    const result = await shared.get("/api/v1/auth/me");

    expect(result).toMatchObject({ success: true, data: { id: "synthetic-user-id" } });
    expect(requests.map((request) => request.url)).toEqual(["/api/v1/auth/me", "/api/v1/auth/refresh", "/api/v1/auth/me"]);
    expect(stored.get("access_token")).toBe("synthetic-retried-access");
    expect(stored.get("refresh_token")).toBe("synthetic-retried-refresh");
    expect(assign).not.toHaveBeenCalled();
  });
});

function respond(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(typeof body === "string" ? body : JSON.stringify(body));
}
