import { describe, expect, it, vi } from "vitest";
import { createRefreshCoordinator, type RefreshDependencies, type TokenPair } from "@/services/auth.refresh";
import { endSession, isSignedOutElsewhere } from "@/services/sign.out";
import { createCrossTabSignOutListener } from "@/hooks/use.cross.tab.sign.out";
import { REFRESH_TOKEN_KEY } from "@/utils/auth";

describe("UC06 sign-out", () => {
  it("clears the browser session before revoking, using the captured refresh token", async () => {
    const order: string[] = [];
    let stored: string | null = "synthetic-refresh";
    const revoke = vi.fn(async (token: string) => {
      order.push(`revoke:${token}`);
      expect(stored).toBeNull(); // nothing local is usable while the server call runs
      return true;
    });
    const confirmed = await endSession({
      readRefreshToken: () => stored,
      clearLocalSession: () => { order.push("clear"); stored = null; },
      revoke,
    });
    expect(confirmed).toBe(true);
    expect(order).toEqual(["clear", "revoke:synthetic-refresh"]);
  });

  it("reports an unconfirmed server revocation instead of a clean sign-out", async () => {
    const clear = vi.fn();
    const confirmed = await endSession({
      readRefreshToken: () => "synthetic-refresh",
      clearLocalSession: clear,
      revoke: async () => false,
    });
    expect(confirmed).toBe(false);
    expect(clear).toHaveBeenCalledOnce(); // the device is still signed out locally
  });

  it("with no stored session it only clears local state and calls nothing", async () => {
    const revoke = vi.fn();
    expect(await endSession({ readRefreshToken: () => null, clearLocalSession: () => {}, revoke })).toBe(true);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("a refresh that completes after sign-out cannot restore the session", async () => {
    let tokens: TokenPair = { accessToken: "h.eyJzdWIiOiJhIiwiZXhwIjo5OTk5OTk5OTk5fQ.s", refreshToken: "synthetic-refresh" };
    let finishRefresh: (value: { accessToken: string; refreshToken: string }) => void = () => {};
    const save = vi.fn((value: TokenPair) => { tokens = value; });
    const deps: RefreshDependencies = {
      read: () => tokens,
      request: () => new Promise((resolve) => { finishRefresh = resolve; }),
      save,
      locks: () => undefined,
      isDenied: () => false,
    };
    const pending = createRefreshCoordinator(deps)(tokens.accessToken);
    await endSession({
      readRefreshToken: () => tokens.refreshToken,
      clearLocalSession: () => { tokens = { accessToken: null, refreshToken: null }; },
      revoke: async () => true,
    });
    finishRefresh({ accessToken: "h.new.s", refreshToken: "synthetic-rotated" });
    await pending;
    expect(save).not.toHaveBeenCalled();
    expect(tokens).toEqual({ accessToken: null, refreshToken: null });
  });
});

describe("UC06 multi-tab session invalidation", () => {
  it("recognises another tab removing the refresh token or clearing storage", () => {
    expect(isSignedOutElsewhere({ key: REFRESH_TOKEN_KEY, newValue: null })).toBe(true);
    expect(isSignedOutElsewhere({ key: null, newValue: null })).toBe(true);
    expect(isSignedOutElsewhere({ key: REFRESH_TOKEN_KEY, newValue: "rotated" })).toBe(false);
    expect(isSignedOutElsewhere({ key: "carts", newValue: null })).toBe(false);
  });

  it("ends this tab's session and leaves the workspace when another tab signs out", () => {
    const onSignedOut = vi.fn();
    const redirect = vi.fn();
    const listener = createCrossTabSignOutListener(onSignedOut, () => "/learner/courses", redirect);
    listener({ key: REFRESH_TOKEN_KEY, newValue: null });
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledOnce();
  });

  it("stays on public pages and ignores token rotation in another tab", () => {
    const onSignedOut = vi.fn();
    const redirect = vi.fn();
    const listener = createCrossTabSignOutListener(onSignedOut, () => "/login", redirect);
    listener({ key: REFRESH_TOKEN_KEY, newValue: "rotated" });
    expect(onSignedOut).not.toHaveBeenCalled();
    listener({ key: REFRESH_TOKEN_KEY, newValue: null });
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });
});
