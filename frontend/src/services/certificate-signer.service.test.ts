import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const reply = (config: InternalAxiosRequestConfig, data: unknown, status = 200, headers: Record<string, string> = {}) =>
  ({ data, status, statusText: "", headers, config });

describe("certificate signer service with actual Axios and refresh interceptors", () => {
  let service: typeof import("./certificate-signer.service");
  let normalize: typeof import("./api.client");
  const requests: InternalAxiosRequestConfig[] = [];
  const stored = new Map<string, string>();
  let handler: (config: InternalAxiosRequestConfig) => Promise<ReturnType<typeof reply>>;
  const originalAdapter = axios.defaults.adapter;
  beforeAll(async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    });
    vi.stubGlobal("window", { dispatchEvent: vi.fn(), location: { pathname: "/organizer", search: "", assign: vi.fn() } });
    axios.defaults.adapter = config => { requests.push(config); return handler(config) as ReturnType<AxiosAdapter>; };
    service = await import("./certificate-signer.service");
    normalize = await import("./api.client");
  });
  beforeEach(() => {
    requests.length = 0; stored.clear();
    handler = async config => reply(config, { data: { version: 7 } }, 200, { etag: '"7"' });
  });
  afterEach(() => { vi.clearAllMocks(); });
  afterAll(() => { axios.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); });

  it("reads quoted ETag and sends it unchanged with normalized multipart text", async () => {
    expect((await service.getSettings()).etag).toBe('"7"');
    const result = await service.updateSettings({ name: "  A\u0301n ", title: " Giám đốc ", signatureAction: "keep" }, '"7"');
    expect(result.etag).toBe('"7"');
    const request = requests[1], body = request.data as FormData;
    expect(request.headers.get("If-Match")).toBe('"7"');
    expect([...body.entries()]).toEqual([["signerName", "Án"], ["signerTitle", "Giám đốc"], ["signatureAction", "keep"]]);
  });
  it("includes the file only for replace", async () => {
    const file = new File(["png"], "signature.png");
    for (const signatureAction of ["replace", "keep", "remove"] as const) {
      await service.updateSettings({ name: "An", title: "Director", signatureAction, file }, '"7"');
      const body = requests.at(-1)!.data as FormData;
      expect(body.has("signature")).toBe(signatureAction === "replace");
      expect([...body.keys()]).toHaveLength(signatureAction === "replace" ? 4 : 3);
    }
  });
  it("does not issue PUT without ETag", async () => {
    await expect(service.updateSettings({ name: "An", title: "Director", signatureAction: "keep" }, null))
      .rejects.toMatchObject({ status: 428 });
    expect(requests).toHaveLength(0);
  });
  it("returns blobs unchanged and requests blob transport", async () => {
    const blob = new Blob(["image"], { type: "image/png" });
    handler = async config => reply(config, blob);
    expect(await service.getSignatureBlob()).toBe(blob);
    expect(requests[0].responseType).toBe("blob");
  });
  it.each(["SIGNATURE_NOT_FOUND", "STORAGE_UNAVAILABLE"])("parses JSON error inside a Blob: %s", async code => {
    handler = async config => { throw new AxiosError("failed", "ERR_BAD_RESPONSE", config, {},
      reply(config, new Blob([JSON.stringify({ error: { code } })]), code === "SIGNATURE_NOT_FOUND" ? 404 : 503) as AxiosResponse); };
    await expect(service.getSignatureBlob()).rejects.toMatchObject({ code });
  });
  it("retains status when a proxy returns a non-JSON blob", async () => {
    const config = {} as InternalAxiosRequestConfig;
    const error = new AxiosError("failed", "ERR_BAD_RESPONSE", config, {},
      reply(config, new Blob(["<html>unavailable</html>"]), 503) as AxiosResponse);
    expect(await normalize.toApiErrorAsync(error)).toMatchObject({ status: 503, code: "HTTP_503" });
  });
  it("401 refresh retries the identical FormData and If-Match once", async () => {
    stored.set("access_token", "synthetic-old-access"); stored.set("refresh_token", "synthetic-refresh");
    handler = async config => {
      if (config.url === "/api/v1/auth/refresh") return reply(config,
        { data: { accessToken: "synthetic-new-access", refreshToken: "synthetic-new-refresh" } });
      if (requests.filter(r => r.method === "put").length === 1) throw new AxiosError("401", "ERR_BAD_REQUEST", config, {},
        reply(config, { error: { code: "UNAUTHORIZED" } }, 401) as AxiosResponse);
      return reply(config, { data: { version: 8 } }, 200, { etag: '"8"' });
    };
    const file = new File(["bytes"], "signature.png");
    const result = await service.updateSettings({ name: "An", title: "Director", signatureAction: "replace", file }, '"7"');
    expect(result.etag).toBe('"8"');
    const puts = requests.filter(r => r.method === "put");
    expect(puts).toHaveLength(2);
    expect(puts[1].data).toBe(puts[0].data);
    expect(puts[1].headers.get("If-Match")).toBe('"7"');
    expect(puts[1].headers.get("Authorization")).toBe("Bearer synthetic-new-access");
    expect((puts[1].data as FormData).get("signature")).toBe(file);
  });
});
