import { describe, expect, it } from "vitest";
import { AUTH_ENDPOINT } from "@/services/auth.session";

/**
 * Sign-in endpoints answer 401 for their own reasons (bad password, unlinked Google account, spent refresh
 * token). They must never trigger a refresh-and-retry, which would replay the credential in the body.
 */
describe("auth endpoints excluded from refresh-and-retry", () => {
  it.each(["login", "google", "refresh", "logout", "revoke"])("/api/v1/auth/%s is excluded", (action) => {
    expect(AUTH_ENDPOINT.test(`/api/v1/auth/${action}`)).toBe(true);
  });

  it.each(["/api/v1/auth/me", "/api/v1/auth/change-password", "/api/v1/notifications"])(
    "%s still refreshes on 401",
    (path) => {
      expect(AUTH_ENDPOINT.test(path)).toBe(false);
    },
  );
});
