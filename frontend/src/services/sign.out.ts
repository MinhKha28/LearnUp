import { REFRESH_TOKEN_KEY } from "@/utils/auth";

export type SignOutDependencies = {
  readRefreshToken: () => string | null;
  clearLocalSession: () => void;
  revoke: (refreshToken: string) => Promise<boolean>;
};

/**
 * UC06: end the browser session, then the server session. Local credentials are cleared first so no
 * request, pending refresh or other tab can keep using them; the captured refresh token is then revoked.
 * Returns whether Identity confirmed the revocation (true when there was no session to end).
 */
export async function endSession(deps: SignOutDependencies): Promise<boolean> {
  const refreshToken = deps.readRefreshToken();
  deps.clearLocalSession();
  if (!refreshToken) return true;
  return deps.revoke(refreshToken);
}

/** Another tab removed the refresh token (sign-out, session end or a cleared storage). */
export const isSignedOutElsewhere = (event: Pick<StorageEvent, "key" | "newValue">): boolean =>
  (event.key === REFRESH_TOKEN_KEY || event.key === null) && event.newValue === null;
