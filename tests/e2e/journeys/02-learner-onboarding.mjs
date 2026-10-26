import fs from "node:fs";
import { GATEWAY, STATE_DIR } from "../lib/config.mjs";
import { login } from "../lib/actors.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";
import { invitationToken, waitForMail } from "../lib/mailbox.mjs";

// UUIDv7 IDs share their first 8 hex digits for ~65.5 s (2^16 ms of the 48-bit timestamp).
const WINDOW_MS = 65536;
const WINDOW_FILE = `${STATE_DIR}/last-activation-window`;

/**
 * Mitigation for known bug ID-1: start the first activation at the beginning of a fresh
 * UUIDv7 window so it never shares Identity's default username with an earlier run.
 */
async function waitForFreshWindow() {
  const last = fs.existsSync(WINDOW_FILE) ? Number(fs.readFileSync(WINDOW_FILE, "utf8")) : -1;
  for (;;) {
    const now = Date.now();
    const win = Math.floor(now / WINDOW_MS);
    const remaining = (win + 1) * WINDOW_MS - now;
    if (win !== last && remaining > 20000) return win;
    await new Promise((r) => setTimeout(r, Math.min(remaining + 200, 5000)));
  }
}

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
    const win = await step("wait for a fresh UUIDv7 window (ID-1 mitigation)", waitForFreshWindow);

    const first = await step("organizer creates learner 1, invitation arrives, accept succeeds", async () => {
      const r = await inviteAndActivate(a, email, `Học viên ${shared.runId} Một`, password);
      expectStatus(r.accepted, 200, "accept invitation");
      assert.equal(data(r.accepted).role, "Learner");
      shared.created.learners.push({ id: r.learner.id, email });
      return r;
    });
    fs.writeFileSync(WINDOW_FILE, String(win));

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
      return { userId: first.learner.id, organizationId: a.organizationId, email, token };
    });

    await step(
      "learner 2 created right after learner 1 can also activate",
      async () => {
        const email2 = `${shared.runId}-l2@e2e.learnup.test`;
        const r = await inviteAndActivate(a, email2, `Học viên ${shared.runId} Hai`, password);
        shared.created.learners.push({ id: r.learner.id, email: email2 });
        expectStatus(r.accepted, 200, "accept invitation of learner 2");
        await login(email2, password);
      },
      { knownBug: "ID-1" },
    );
  },
};
