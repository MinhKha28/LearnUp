import { GATEWAY, loadClusterEnv, SEED } from "./config.mjs";
import { request, data } from "./http.mjs";

/** Logs in through the gateway exactly as the frontend does; returns the access token. */
export async function login(email, password) {
  const res = await request("POST", `${GATEWAY}/api/v1/auth/login`, {
    json: { username: email, password },
    label: "/api/v1/auth/login",
  });
  if (res.status !== 200 || !data(res)?.accessToken)
    throw new Error(`login ${email} -> HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
  return data(res).accessToken;
}

export async function seededOrganizers() {
  const env = loadClusterEnv();
  return {
    a: { ...SEED.organizerA, token: await login(SEED.organizerA.email, env.FIXTURE_ORGANIZER_PASSWORD) },
    b: { ...SEED.organizerB, token: await login(SEED.organizerB.email, env.FIXTURE_ORGANIZER_PASSWORD) },
  };
}

/**
 * Headers the gateway injects after JWT validation. Used ONLY by diagnostic steps that
 * bypass a missing gateway route, to keep checking the business rule behind it.
 */
export function gatewayEquivalentHeaders(actor, role) {
  const env = loadClusterEnv();
  return {
    "x-internal-key": env.INTERNAL_SERVICE_KEY,
    "x-user-id": actor.userId,
    "x-organization-id": actor.organizationId,
    "x-user-role": role,
  };
}
