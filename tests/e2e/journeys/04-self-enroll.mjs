import { GATEWAY, SEED } from "../lib/config.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";

export default {
  id: "J4",
  title: "Learner browses catalog, views course intro, self-enrolls, sees it in My Enrollments",
  services: ["api-gateway", "course", "learning"],
  async run({ step, shared, skip }) {
    if (!shared.learner) skip("no activated learner from J2");
    const { token } = shared.learner;
    const courseId = SEED.coursePublicNoAssignment;

    await step("catalog lists published public courses only", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/courses/catalog`, { token }), 200);
      const ids = data(res).items.map((c) => c.id);
      assert.ok(ids.includes(courseId), "public published course missing from catalog");
      assert.ok(!ids.includes(SEED.coursePrivate), "private course leaked into catalog");
      assert.ok(!ids.includes(SEED.courseDraft), "draft course leaked into catalog");
    });
    await step("course introduction shows modules and lessons", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/courses/${courseId}/introduction`, { token, label: "/api/v1/courses/:id/introduction" }), 200);
      assert.equal(data(res).id, courseId);
      assert.ok(data(res).modules.length > 0 && data(res).modules[0].lessons.length > 0, "introduction has no lessons");
    });
    await step("introduction of a draft course is not visible", async () => {
      const res = await request("GET", `${GATEWAY}/api/v1/courses/${SEED.courseDraft}/introduction`, { token, label: "/api/v1/courses/:id/introduction (draft)" });
      assert.ok([403, 404].includes(res.status), `draft intro expected 403/404, got ${res.status}`);
    });
    const enrollment = await step("self-enroll creates an Optional NotStarted enrollment", async () => {
      const res = expectStatus(await request("POST", `${GATEWAY}/api/v1/enrollments`, { token, json: { courseId } }), 201);
      assert.equal(data(res).courseId, courseId);
      assert.equal(data(res).enrollmentType, "Optional");
      assert.equal(data(res).status, "NotStarted");
      shared.created.enrollments.push({ id: data(res).id, type: "Optional", learnerId: shared.learner.userId });
      shared.selfEnrollmentId = data(res).id;
      return data(res);
    });
    await step("enrolling again does not create a second enrollment", async () => {
      const res = await request("POST", `${GATEWAY}/api/v1/enrollments`, { token, json: { courseId }, label: "/api/v1/enrollments (again)" });
      if (res.status === 201) assert.equal(data(res).id, enrollment.id, "second enrollment created");
      else assert.ok(res.status === 409, `expected 201 same id or 409, got ${res.status}`);
    });
    await step("my course IDs include the enrollment (catalog badge)", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/enrollments/me/course-ids`, { token }), 200);
      assert.ok(data(res).some((r) => r.courseId === courseId && r.enrollmentId === enrollment.id));
    });
    await step("My Enrollments shows the course with its required material count", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/enrollments/me`, { token }), 200);
      const item = data(res).items.find((i) => i.enrollmentId === enrollment.id);
      assert.ok(item, "self-enrollment missing from /enrollments/me");
      assert.equal(item.enrollmentType, "Optional");
      assert.equal(item.requiredMaterials.completed, 0);
      assert.ok(item.requiredMaterials.total > 0);
    });
  },
};
