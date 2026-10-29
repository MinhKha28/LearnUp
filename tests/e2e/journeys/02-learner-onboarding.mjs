import { GATEWAY } from "../lib/config.mjs";
import { login } from "../lib/actors.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";
import { invitationToken, waitForMail } from "../lib/mailbox.mjs";

/** Identity's default username when Tenant sends none: "user_" + the full user ID without dashes. */
const defaultUsername = (userId) => `user_${userId.replace(/-/g, "")}`;

async function inviteAndActivate(organizer, email, fullName, password) {
  const created = expectStatus(
    await request("POST", `${GATEWAY}/api/v1/users/learners`, { token: organizer.token, json: { fullName, email } }),
    201,
    "create learner",
  );
  const learner = data(created);
  assert.equal(learner.status, "Pending");
  const mail = await waitForMail(email);
  const token = invitationToken(mail);
  const preview = expectStatus(
    await request("GET", `${GATEWAY}/api/v1/invitations/${token}`, { label: "/api/v1/invitations/:token" }),
    200,
    "invitation preview",
  );
  assert.equal(data(preview).email ?? email, email);
  const accepted = await request("POST", `${GATEWAY}/api/v1/invitations/accept`, { json: { token, password } });
  return { learner, token, accepted };
}

export default {
  id: "J2",
  title: "Organizer creates learners, invitation email, accept, learner login",
  services: ["api-gateway", "tenant", "notification", "identity"],
  async run({ step, shared }) {
    const a = shared.organizers.a;
    const password = `E2e-${shared.runId}-Pw1!`;
    const email = `${shared.runId}-l1@e2e.learnup.test`;

    const first = await step("organizer creates learner 1, invitation arrives, accept succeeds", async () => {
      const r = await inviteAndActivate(a, email, `Học viên ${shared.runId} Một`, password);
      expectStatus(r.accepted, 200, "accept invitation");
      assert.equal(data(r.accepted).role, "Learner");
      shared.created.learners.push({ id: r.learner.id, email });
      return r;
    });

    await step("organizer reads learner 1 back as Active", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/users/learners/${first.learner.id}`, { token: a.token, label: "/api/v1/users/learners/:id" }), 200);
      assert.equal(data(res).status, "Active");
    });
    await step("invitation token cannot be reused", async () => {
      const res = await request("POST", `${GATEWAY}/api/v1/invitations/accept`, { json: { token: first.token, password }, label: "/api/v1/invitations/accept (reuse)" });
      assert.ok(res.status >= 400 && res.status < 500, `reuse expected 4xx, got ${res.status}`);
    });
    shared.learner = await step("learner 1 logs in through gateway with LEARNER role", async () => {
      const token = await login(email, password);
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/auth/me`, { token }), 200);
      assert.equal(data(res).id, first.learner.id);
      assert.equal(data(res).role, "LEARNER");
      assert.equal(data(res).username, defaultUsername(first.learner.id));
      return { userId: first.learner.id, organizationId: a.organizationId, email, token };
    });

    await step("learner 2 created right after learner 1 activates with its own default username", async () => {
      const email2 = `${shared.runId}-l2@e2e.learnup.test`;
      const r = await inviteAndActivate(a, email2, `Học viên ${shared.runId} Hai`, password);
      shared.created.learners.push({ id: r.learner.id, email: email2 });
      expectStatus(r.accepted, 200, "accept invitation of learner 2");
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/auth/me`, { token: await login(email2, password) }), 200);
      assert.equal(data(res).id, r.learner.id);
      assert.equal(data(res).username, defaultUsername(r.learner.id));
      assert.notEqual(data(res).username, defaultUsername(first.learner.id));
      if (r.learner.id.slice(0, 8) !== first.learner.id.slice(0, 8))
        console.log(`   note: learner IDs crossed a UUIDv7 prefix boundary, same-prefix case not exercised this run`);
    });
  },
};
