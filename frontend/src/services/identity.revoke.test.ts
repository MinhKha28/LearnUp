import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiosHeaders } from "axios";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/services/axios.customize", () => ({ default: { post, get: vi.fn() } }));

import { revokeSessionAPI } from "@/services/identity.service";

const TOKEN = "synthetic-refresh-token";
const respond = (status: number, body: unknown) =>
  post.mockResolvedValue({ status, data: typeof body === "string" ? body : JSON.stringify(body) });

describe("UC06 revokeSessionAPI", () => {
  afterEach(() => post.mockReset());

  it("calls the public revoke route with only the refresh token and no identity headers", async () => {
    respond(200, { success: true, data: { message: "Session ended" } });
    await expect(revokeSessionAPI(TOKEN)).resolves.toBe(true);

    const [path, body, config] = post.mock.calls[0];
    expect(path).toBe("/api/v1/auth/revoke");
    expect(body).toEqual({ refreshToken: TOKEN });
    expect(config.validateStatus(401)).toBe(true); // no 401 → refresh/retry loop
    const headers = new AxiosHeaders({ Authorization: "Bearer expired", "X-User-ID": "spoof", "X-Internal-Key": "spoof" });
    expect(config.transformRequest[0](body, headers)).toBe(JSON.stringify({ refreshToken: TOKEN }));
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.has("X-User-ID")).toBe(false);
    expect(headers.has("X-Internal-Key")).toBe(false);
  });

  it.each([
    ["server error", 500, { success: false, error: { code: "INTERNAL_ERROR" } }],
    ["Identity unavailable at the Gateway", 503, { success: false, error: { code: "SERVICE_UNAVAILABLE" } }],
    ["unexpected envelope", 200, { success: false }],
    ["non-JSON body", 502, "<html>Bad Gateway</html>"],
  ])("returns false on %s", async (_label, status, body) => {
    respond(status as number, body);
    await expect(revokeSessionAPI(TOKEN)).resolves.toBe(false);
  });

  it("returns false on a network failure and never rethrows the request (it carries the token)", async () => {
    post.mockRejectedValue(Object.assign(new Error("Network Error"), { config: { data: JSON.stringify({ refreshToken: TOKEN }) } }));
    await expect(revokeSessionAPI(TOKEN)).resolves.toBe(false);
  });
});
