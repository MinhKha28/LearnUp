import { afterEach, describe, expect, it, vi } from "vitest";
import { createRefreshCoordinator, type TokenPair, type RefreshDependencies } from "./auth.refresh";

const jwt = (sub = "a", exp = 9_999_999_999, version = 1) => `h.${btoa(JSON.stringify({ sub, organizationId: "org", exp, version }))}.s`;
function lockQueue() {
  let tail = Promise.resolve();
  const request = vi.fn((_name: string, options: LockOptions, callback: () => Promise<unknown>) => {
    const result = tail.then(() => {
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return callback();
    });
    tail = result.then(() => {}, () => {});
    return result;
  });
  return { request } as unknown as Pick<LockManager, "request">;
}
function fixture(locks: Pick<LockManager, "request"> | undefined = lockQueue()) {
  let tokens: TokenPair = { accessToken: jwt(), refreshToken: "synthetic-refresh" };
  const request = vi.fn().mockResolvedValue({ accessToken: jwt("a", 9_999_999_999, 2), refreshToken: "synthetic-new-refresh" });
  const save = vi.fn((value: TokenPair) => { tokens = value; });
  const dependencies: RefreshDependencies = { read: () => tokens, request, save, locks: () => locks, isDenied: error => error === "denied" };
  return { dependencies, request, save, read: () => tokens, set: (value: TokenPair) => { tokens = value; } };
}
afterEach(() => vi.useRealTimers());

describe("refresh coordination", () => {
  it("shares proactive and reactive refresh within a tab", async () => {
    const f = fixture(), run = createRefreshCoordinator(f.dependencies), old = f.read().accessToken;
    const [a, b] = await Promise.all([run(old, true), run(old)]);
    expect(a.token).toBe(b.token); expect(f.request).toHaveBeenCalledTimes(1);
    expect(f.save).toHaveBeenCalledOnce();
  });
  it("refreshes only once across two tabs sharing a lock and storage", async () => {
    const f = fixture(), a = createRefreshCoordinator(f.dependencies), b = createRefreshCoordinator(f.dependencies), old = f.read().accessToken;
    const results = await Promise.all([a(old, true), b(old)]);
    expect(f.request).toHaveBeenCalledTimes(1);
    expect(results[0].token).toBe(results[1].token);
  });
  it("uses a fresh token from storage for a late HTTP401 without another refresh", async () => {
    const f = fixture(), run = createRefreshCoordinator(f.dependencies), old = f.read().accessToken;
    await run(old);
    await run(old);
    expect(f.request).toHaveBeenCalledTimes(1);
  });
  it("disables proactive refresh without locks and retains same-tab HTTP401 deduplication", async () => {
    const f = fixture(); f.dependencies.locks = () => undefined;
    const run = createRefreshCoordinator(f.dependencies);
    expect((await run(undefined, true)).token).toBeNull();
    expect(f.request).not.toHaveBeenCalled();
    await Promise.all([run(), run()]); expect(f.request).toHaveBeenCalledOnce();
  });
  it("reads storage again after refresh failure before considering the session ended", async () => {
    const f = fixture(), replacement = jwt("a", 9_999_999_999, 3);
    f.request.mockImplementationOnce(async () => {
      f.set({ accessToken: replacement, refreshToken: "synthetic-other-refresh" });
      throw "denied";
    });
    expect(await createRefreshCoordinator(f.dependencies)()).toEqual({ token: replacement, ended: false });
  });
  it("does not overwrite logout or a new user's login with an in-flight refresh", async () => {
    for (const replacement of [null, jwt("b")]) {
      const f = fixture();
      f.request.mockImplementationOnce(async () => {
        f.set({ accessToken: replacement, refreshToken: replacement ? "other" : null });
        return { accessToken: jwt("a", 9_999_999_999, 2), refreshToken: "old-response" };
      });
      expect(await createRefreshCoordinator(f.dependencies)()).toEqual({ token: null, ended: false });
      expect(f.save).not.toHaveBeenCalled();
    }
  });
  it("retains the session after network failure and ends it only on a definitive denial", async () => {
    const f = fixture();
    f.request.mockRejectedValueOnce(new Error("offline"));
    expect((await createRefreshCoordinator(f.dependencies)()).ended).toBe(false);
    f.request.mockRejectedValueOnce("denied");
    expect((await createRefreshCoordinator(f.dependencies)()).ended).toBe(true);
  });
  it.each([true, false])("times out a lock wait at 15 seconds; token valid=%s", async valid => {
    vi.useFakeTimers();
    const f = fixture();
    f.set({ accessToken: jwt("a", valid ? 9_999_999_999 : 1), refreshToken: "synthetic-refresh" });
    f.dependencies.locks = () => ({ request: ((_name: string, options: LockOptions) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as LockManager["request"] });
    const pending = createRefreshCoordinator(f.dependencies)();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toEqual({ token: valid ? f.read().accessToken : null, ended: false });
    expect(f.request).not.toHaveBeenCalled();
  });
});
