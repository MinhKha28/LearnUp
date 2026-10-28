import { DIRECT, GATEWAY } from "../lib/config.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";

const claims = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));

export default {
  id: "J1",
  title: "Login through identity, authorised call through gateway, unauthorised calls rejected",
  services: ["api-gateway", "identity", "tenant"],
  async run({ step, shared }) {
    const a = shared.organizers.a;
    await step("organizer JWT carries canonical user, role and organization", () => {
      const c = claims(a.token);
      assert.equal(c.sub, a.userId);
      assert.equal(c.role, "ORGANIZER");
      assert.equal(c.organizationId, a.organizationId);
    });
    await step("GET /auth/me through gateway returns the same user", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/auth/me`, { token: a.token }), 200);
      assert.equal(data(res).id, a.userId);
    });
    await step("authorised tenant call through gateway returns organization seat usage", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/users/learners/seats`, { token: a.token }), 200);
      assert.equal(typeof data(res).max, "number");
      assert.equal(data(res).subscriptionStatus, "Active");
    });
    await step("wrong password is rejected with 401", async () => {
      expectStatus(
        await request("POST", `${GATEWAY}/api/v1/auth/login`, {
          json: { username: a.email, password: "definitely-wrong-password" },
          label: "/api/v1/auth/login (wrong password)",
        }),
        401,
      );
    });
    await step("protected route without token is rejected by gateway with 401", async () => {
      expectStatus(await request("GET", `${GATEWAY}/api/v1/users/learners/seats`, { label: "/api/v1/users/learners/seats (no token)" }), 401);
    });
    await step("token with tampered signature is rejected with 401", async () => {
      const [h, p, s] = a.token.split(".");
      const tampered = `${h}.${p}.${s.slice(0, -4)}${s.slice(-4) === "AAAA" ? "BBBB" : "AAAA"}`;
      expectStatus(await request("GET", `${GATEWAY}/api/v1/users/learners/seats`, { token: tampered, label: "/api/v1/users/learners/seats (tampered)" }), 401);
    });
    await step("spoofed identity headers without a token do not authenticate", async () => {
      expectStatus(
        await request("GET", `${GATEWAY}/api/v1/users/learners/seats`, {
          headers: { "x-user-id": a.userId, "x-organization-id": a.organizationId, "x-user-role": "ORGANIZER", "x-internal-key": "guess" },
          label: "/api/v1/users/learners/seats (spoofed headers)",
        }),
        401,
      );
    });
    await step("business service called directly without internal key returns 401", async () => {
      expectStatus(
        await request("GET", `${DIRECT.learning}/api/v1/enrollments/me`, {
          headers: { "x-user-id": a.userId, "x-organization-id": a.organizationId, "x-user-role": "LEARNER" },
          label: "direct learning /api/v1/enrollments/me (no key)",
        }),
        401,
      );
    });
  },
};
