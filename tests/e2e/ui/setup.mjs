import { GATEWAY } from "../lib/config.mjs";
import { login } from "../lib/actors.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";
import { invitationToken, waitForMail } from "../lib/mailbox.mjs";

/** Same path as API journey J2 (create, invitation email, accept), used here only as setup. */
export async function createLearner(organizer, runId) {
  const email = `${runId}-ui@e2e.learnup.test`;
  const password = `E2e-${runId}-Pw1!`;
  const fullName = `Học viên ${runId} UI`;
  const created = expectStatus(
    await request("POST", `${GATEWAY}/api/v1/users/learners`, { token: organizer.token, json: { fullName, email } }),
    201,
    "create learner",
  );
  const token = invitationToken(await waitForMail(email));
  expectStatus(await request("POST", `${GATEWAY}/api/v1/invitations/accept`, { json: { token, password } }), 200, "accept invitation");
  const userToken = await login(email, password);
  const me = data(expectStatus(await request("GET", `${GATEWAY}/api/v1/auth/me`, { token: userToken }), 200));
  assert.equal(me.id, data(created).id);
  return { userId: me.id, email, password, fullName, token: userToken };
}
