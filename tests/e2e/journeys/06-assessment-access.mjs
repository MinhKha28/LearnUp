import { GATEWAY, SEED } from "../lib/config.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";

const assessments = (courseId, token, label) =>
  request("GET", `${GATEWAY}/api/v1/assessments/learner/courses/${courseId}/assessments`, {
    token,
    label: `/api/v1/assessments/learner/courses/:id/assessments${label ? ` (${label})` : ""}`,
  });

export default {
  id: "J6",
  title: "Assessment access follows enrollment status (L17): enrolled, not enrolled, withdrawn",
  services: ["api-gateway", "assessment", "learning"],
  async run({ step, shared, skip }) {
    if (!shared.learner) skip("no activated learner from J2");
    const { token } = shared.learner;
    const courseId = SEED.coursePublicV2;

    await step("not enrolled: learner assessments return 403 NOT_ENROLLED", async () => {
      const res = expectStatus(await assessments(courseId, token, "not enrolled"), 403);
      assert.equal(res.body.error?.code, "NOT_ENROLLED");
    });
    const enrollmentId = await step("after self-enroll: assessments open and name the enrollment", async () => {
      const enr = expectStatus(await request("POST", `${GATEWAY}/api/v1/enrollments`, { token, json: { courseId } }), 201);
      const id = data(enr).id;
      shared.created.enrollments.push({ id, type: "Optional", learnerId: shared.learner.userId });
      const res = expectStatus(await assessments(courseId, token), 200);
      assert.equal(data(res).enrollmentId, id);
      assert.equal(data(res).readOnly, false);
      return id;
    });
    if (shared.assignedEnrollmentId) {
      await step("assigned (Required) enrollment also opens its course assessments", async () => {
        const res = expectStatus(await assessments(SEED.coursePrivate, token, "assigned"), 200);
        assert.equal(data(res).enrollmentId, shared.assignedEnrollmentId);
      });
    }
    await step("learner withdraws the optional enrollment", async () => {
      expectStatus(await request("POST", `${GATEWAY}/api/v1/enrollments/${enrollmentId}/withdrawal`, { token, label: "/api/v1/enrollments/:id/withdrawal" }), 200);
      const me = expectStatus(await request("GET", `${GATEWAY}/api/v1/enrollments/me/course-ids`, { token }), 200);
      const ref = data(me).find((r) => r.enrollmentId === enrollmentId);
      assert.ok(!ref || ref.status === "Withdrawn", `withdrawn enrollment still active: ${JSON.stringify(ref)}`);
    });
    await step("withdrawn: assessments are closed (403)", async () => {
      expectStatus(await assessments(courseId, token, "withdrawn"), 403);
    });
  },
};
