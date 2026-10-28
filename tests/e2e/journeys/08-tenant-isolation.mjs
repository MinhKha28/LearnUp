import { GATEWAY } from "../lib/config.mjs";
import { organizationCourseIds } from "../lib/courses.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";

export default {
  id: "J8",
  title: "Tenant isolation: organization B cannot read organization A's learners, courses, enrollments or settings",
  services: ["api-gateway", "tenant", "course", "learning", "achievement-reporting"],
  async run({ step, shared, skip }) {
    const b = shared.organizers.b;
    if (!shared.learner) skip("no activated learner from J2");
    const learner = shared.learner;

    await step("organizer B cannot read org A's learner (404)", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/users/learners/${learner.userId}`, { token: b.token, label: "/api/v1/users/learners/:id (other org)" }), 404);
      assert.notEqual(res.body?.data?.email, learner.email);
    });
    await step("organizer B's learner list does not contain org A's learner", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/users/learners?keyword=${encodeURIComponent(shared.runId)}`, { token: b.token, label: "/api/v1/users/learners?keyword" }), 200);
      assert.ok(!JSON.stringify(data(res)).includes(learner.userId), "org A learner visible to org B");
    });
    await step("organizer B's organization courses contain no org A course", async () => {
      const ids = await organizationCourseIds(b.token, "/api/v1/courses/organization (org B)");
      const aIds = await organizationCourseIds(shared.organizers.a.token);
      assert.ok(aIds.size > 0, "organization A has no courses, isolation not exercised");
      assert.ok([...ids].every((id) => !aIds.has(id)), "org A course listed for org B");
    });
    if (shared.signerNameA) {
      await step("organizer B's signer settings are not org A's", async () => {
        const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/certificates/signer-settings`, { token: b.token, label: "/api/v1/certificates/signer-settings (org B)" }), 200);
        assert.notEqual(data(res).signerName, shared.signerNameA);
      });
    }
    if (shared.assignedEnrollmentId) {
      await step("organizer B cannot read org A's assignment detail through gateway (404)", async () => {
        expectStatus(await request("GET", `${GATEWAY}/api/v1/assignments/${shared.assignedEnrollmentId}`, { token: b.token, label: "/api/v1/assignments/:id (other org)" }), 404);
        const own = await request("GET", `${GATEWAY}/api/v1/assignments/${shared.assignedEnrollmentId}`, { token: shared.organizers.a.token, label: "/api/v1/assignments/:id" });
        expectStatus(own, 200, "org A reads its own assignment (proves the 404 above is isolation, not routing)");
      });
    }
    if (shared.selfEnrollmentId) {
      await step("organizer B's token cannot open org A learner's curriculum", async () => {
        const res = await request("GET", `${GATEWAY}/api/v1/enrollments/${shared.selfEnrollmentId}/curriculum`, { token: b.token, label: "/api/v1/enrollments/:id/curriculum (other org)" });
        assert.ok([403, 404].includes(res.status), `expected 403/404, got ${res.status}`);
      });
    }
    await step("spoofed org/user headers on a learner request are replaced by the gateway", async () => {
      const orgACourses = await organizationCourseIds(shared.organizers.a.token);
      const res = expectStatus(
        await request("GET", `${GATEWAY}/api/v1/enrollments/me`, {
          token: learner.token,
          headers: { "x-user-id": b.userId, "x-organization-id": b.organizationId, "x-user-role": "ORGANIZER" },
          label: "/api/v1/enrollments/me (spoofed headers)",
        }),
        200,
      );
      const items = data(res).items;
      assert.ok(items.length > 0, "learner's own enrollments not returned");
      const foreign = items.filter((i) => !orgACourses.has(i.courseId));
      assert.deepEqual(foreign, [], "enrollments outside organization A returned");
      if (shared.selfEnrollmentId) assert.ok(items.some((i) => i.enrollmentId === shared.selfEnrollmentId), "learner's own enrollment missing");
    });
  },
};
