import { GATEWAY } from "./config.mjs";
import { login } from "./actors.mjs";
import { assert, expectStatus } from "./harness.mjs";
import { data, request } from "./http.mjs";
import { invitationToken, waitForMail } from "./mailbox.mjs";

/** Organizer creates a Learner, the invitation mail is read from the SMTP sink, the invitation is accepted. */
export async function inviteAndActivate(organizer, email, fullName, password) {
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

/** A new activated Learner of the Organizer's organization, logged in through the gateway. */
export async function freshLearner(organizer, email, fullName, password) {
  const r = await inviteAndActivate(organizer, email, fullName, password);
  expectStatus(r.accepted, 200, "accept invitation");
  return { id: r.learner.id, userId: r.learner.id, organizationId: organizer.organizationId, email, token: await login(email, password) };
}
