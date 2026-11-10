import { accessClaims, sameTokenOwner, tokenIsCurrent } from "@/utils/auth.claims";

export interface TokenPair { accessToken: string | null; refreshToken: string | null }
export interface RefreshResult { token: string | null; ended: boolean }
export interface RefreshDependencies {
  read: () => TokenPair;
  request: (refreshToken: string) => Promise<{ accessToken: string; refreshToken: string }>;
  save: (tokens: { accessToken: string; refreshToken: string }) => void;
  locks: () => Pick<LockManager, "request"> | undefined;
  isDenied: (error: unknown) => boolean;
}

/** Serialize rotating refresh tokens across callers and, where supported, tabs. */
export function createRefreshCoordinator(deps: RefreshDependencies) {
  let pending: Promise<RefreshResult> | null = null;
  return (expected = deps.read().accessToken, proactive = false): Promise<RefreshResult> => {
    const locks = deps.locks();
    if (proactive && !locks) return Promise.resolve({ token: null, ended: false });
    if (pending) return pending;
    const initial = deps.read();
    const usableReplacement = () => {
      const current = deps.read();
      return sameTokenOwner(expected, current.accessToken) && tokenIsCurrent(current.accessToken)
        && current.accessToken !== expected ? current.accessToken : null;
    };
    const work = async (): Promise<RefreshResult> => {
      const current = deps.read();
      if (accessClaims(expected) && !sameTokenOwner(expected, current.accessToken))
        return { token: null, ended: false };
      if (current.accessToken !== initial.accessToken || current.refreshToken !== initial.refreshToken) {
        return { token: usableReplacement(), ended: false };
      }
      const replacement = usableReplacement();
      if (replacement) return { token: replacement, ended: false };
      if (!current.refreshToken) return { token: null, ended: true };
      try {
        const tokens = await deps.request(current.refreshToken);
        const latest = deps.read();
        if (latest.accessToken !== current.accessToken || latest.refreshToken !== current.refreshToken)
          return { token: usableReplacement(), ended: false };
        deps.save(tokens);
        return { token: tokens.accessToken, ended: false };
      } catch (error) {
        const token = usableReplacement();
        const latest = deps.read();
        return { token, ended: deps.isDenied(error) && !token && latest.accessToken === current.accessToken
          && latest.refreshToken === current.refreshToken };
      }
    };
    const run = async (): Promise<RefreshResult> => {
      if (!locks) return work();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        // Abort only the lock wait; an acquired refresh has its own HTTP timeout.
        return await locks.request("learnup.auth-refresh", { signal: controller.signal }, () => {
          clearTimeout(timer);
          return work();
        });
      } catch {
        const current = deps.read().accessToken;
        return { token: sameTokenOwner(expected, current) && tokenIsCurrent(current) ? current : null,
          ended: false };
      } finally {
        clearTimeout(timer);
      }
    };
    pending = run().finally(() => { pending = null; });
    return pending;
  };
}
