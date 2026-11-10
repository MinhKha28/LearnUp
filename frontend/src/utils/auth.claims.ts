export interface AccessClaims {
  sub: string;
  organizationId: string;
  exp: number;
}

/** Decode scheduling and ownership hints; the server still validates the JWT. */
export function accessClaims(token: string | null): AccessClaims | null {
  try {
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const value: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (!value || typeof value !== "object") return null;
    const claims = value as Partial<AccessClaims>;
    return typeof claims.sub === "string" && typeof claims.organizationId === "string"
      && typeof claims.exp === "number" && Number.isFinite(claims.exp)
      ? claims as AccessClaims : null;
  } catch {
    return null;
  }
}

export const tokenIsCurrent = (token: string | null, now = Date.now()) =>
  (accessClaims(token)?.exp ?? 0) * 1000 > now;

export const sameTokenOwner = (left: string | null, right: string | null) => {
  const a = accessClaims(left), b = accessClaims(right);
  return !!a && !!b && a.sub === b.sub && a.organizationId === b.organizationId;
};
