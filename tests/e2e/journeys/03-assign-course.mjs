import { GATEWAY, SEED } from "../lib/config.mjs";
import { organizationCourseIds } from "../lib/courses.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";
import { endOffsets, waitForEvent } from "../lib/kafka.mjs";

const TOPIC = "learnup.learning.enrollment-events";

export default {
  id: "J3",
  title: "Organizer assigns a course; learner sees the required enrollment; EnrollmentAssigned reaches Kafka",
  services: ["api-gateway", "learning", "tenant", "course", "kafka"],
  async run({ step, shared, skip }) {
    if (!shared.learner) skip("no activated learner from J2");
    const a = shared.organizers.a;
    const learner = shared.learner;
    const courseId = SEED.coursePrivate;
    const body = { courseId, learnerIds: [learner.userId] };
    const since = await step("record Kafka end offsets of the enrollment topic", () => endOffsets(TOPIC));

    await step("organizer's organization courses list the published private course", async () => {
      const ids = await organizationCourseIds(a.token);
      assert.ok(ids.has(courseId), `course ${courseId} missing from organization courses`);
    });

    await step("POST /api/v1/assignments through gateway (frontend path) creates 1 enrollment", async () => {
      const res = expectStatus(await request("POST", `${GATEWAY}/api/v1/assignments`, { token: a.token, json: body }), 201);
      assert.equal(data(res).created, 1);
    });

    const enrollment = await step("learner sees the Required enrollment with a due date in My Enrollments", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/enrollments/me`, { token: learner.token }), 200);
      const item = data(res).items.find((i) => i.courseId === courseId);
      assert.ok(item, "assigned course missing from /enrollments/me");
      assert.equal(item.enrollmentType, "Required");
      assert.equal(item.status, "NotStarted");
      assert.ok(item.dueAt, "assigned enrollment has no dueAt");
      shared.created.enrollments.push({ id: item.enrollmentId, type: "Required", learnerId: learner.userId });
      shared.assignedEnrollmentId = item.enrollmentId;
      return item;
    });

    await step("organizer assignment list through gateway shows the learner", async () => {
      const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/assignments`, { token: a.token }), 200);
      const row = data(res).items.find((i) => i.enrollmentId === enrollment.enrollmentId);
      assert.ok(row, "enrollment missing from organizer assignment list");
      assert.equal(row.learner.id, learner.userId);
      assert.equal(row.course.id, courseId);
    });
    await step("re-assigning the same learner through gateway is rejected as ALREADY_ASSIGNED, no duplicate", async () => {
      const res = expectStatus(await request("POST", `${GATEWAY}/api/v1/assignments`, { token: a.token, json: body, label: "/api/v1/assignments (again)" }), 422);
      assert.equal(res.body.error?.code, "ASSIGNMENT_INVALID_LEARNERS");
      assert.deepEqual(res.body.error.errors, [{ learnerId: learner.userId, reason: "ALREADY_ASSIGNED" }]);
      const me = expectStatus(await request("GET", `${GATEWAY}/api/v1/enrollments/me`, { token: learner.token }), 200);
      assert.equal(data(me).items.filter((i) => i.courseId === courseId).length, 1);
    });
    await step("EnrollmentAssigned event for this enrollment is published to Kafka", async () => {
      const event = await waitForEvent(TOPIC, since, (e) => e.eventType === "EnrollmentAssigned" && e.data?.enrollmentId === enrollment.enrollmentId);
      assert.ok(event, "no EnrollmentAssigned event within 20 s");
      assert.equal(event.organizationId, a.organizationId);
      assert.equal(event.data.learnerId, learner.userId);
      assert.equal(event.data.courseId, courseId);
      assert.equal(event.data.assignedBy, a.userId);
    });
  },
};
