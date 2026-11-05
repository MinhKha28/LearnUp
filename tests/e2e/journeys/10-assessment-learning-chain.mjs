import { GATEWAY, SEED } from "../lib/config.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";
import { freshLearner } from "../lib/learners.mjs";
import { sql, literal } from "../lib/db.mjs";
import { endOffsets, groupLag, produceMessage, waitForMessage } from "../lib/kafka.mjs";

const TOPIC = "learnup.assessment.learner-assessment-events";
const GROUP = "learning-assessment-status-v1";
/**
 * Upper bound for each chain hop. Expected latency is ~2-4 s (relay poll 1 s, consumer
 * fetch + one transaction); 15 s leaves margin for a loaded shared host
 * without hiding a consumer that is not running at all.
 */
const POLL_TIMEOUT_MS = 15000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(what, read, done, timeoutMs = POLL_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let last;
  for (;;) {
    last = await read();
    if (done(last)) return last;
    if (Date.now() >= deadline) throw new Error(`${what}: not reached within ${timeoutMs} ms; last observed ${JSON.stringify(last)}`);
    await sleep(500);
  }
}

export default {
  id: "J10",
  title: "Learner submits an Assignment; assessment outbox -> Kafka -> learning moves the Enrollment to InProgress",
  services: ["api-gateway", "assessment", "learning", "kafka"],
  async run({ step, shared }) {
    const a = shared.organizers.a;
    const courseId = SEED.coursePrivate;
    const assignmentId = SEED.assignmentNoPeerReview;
    const password = `E2e-${shared.runId}-Pw1!`;
    const email = `${shared.runId}-l10@e2e.learnup.test`;

    const learner = await step("fresh learner is created, activated and logged in through the gateway", async () => {
      const l = await freshLearner(a, email, `Học viên ${shared.runId} Mười`, password);
      shared.created.learners.push({ id: l.userId, email });
      return l;
    });
    const since = await step("record Kafka end offsets of the assessment topic", () => endOffsets(TOPIC));

    const enrollmentId = await step("organizer assigns the course (Required); learner's enrollment is NotStarted", async () => {
      expectStatus(await request("POST", `${GATEWAY}/api/v1/assignments`, { token: a.token, json: { courseId, learnerIds: [learner.userId] } }), 201);
      const me = expectStatus(await request("GET", `${GATEWAY}/api/v1/enrollments/me`, { token: learner.token }), 200);
      const item = data(me).items.find((i) => i.courseId === courseId);
      assert.ok(item, "assigned course missing from /enrollments/me");
      assert.equal(item.enrollmentType, "Required");
      assert.equal(item.status, "NotStarted");
      shared.created.enrollments.push({ id: item.enrollmentId, type: "Required", learnerId: learner.userId });
      return item.enrollmentId;
    });
    const readAssignment = async () => data(expectStatus(await request("GET", `${GATEWAY}/api/v1/assignments/${enrollmentId}`, { token: a.token, label: "/api/v1/assignments/:enrollmentId" }), 200));
    await step("organizer view: first activity is still empty", async () => {
      assert.equal((await readAssignment()).firstActivityAt, null);
    });

    const submissionId = await step("learner submits a text-only answer through the gateway", async () => {
      const res = expectStatus(
        await request("POST", `${GATEWAY}/api/v1/assessments/learner/assignments/${assignmentId}/submissions`, {
          token: learner.token,
          form: { content: `Báo cáo rà soát bảo mật ${shared.runId}: kiểm tra quyền truy cập, mật khẩu và sao lưu.` },
          label: "/api/v1/assessments/learner/assignments/:id/submissions",
        }),
        201,
      );
      const id = data(res).submissionId ?? data(res).id;
      assert.ok(id, `no submission id in receipt: ${JSON.stringify(res.body).slice(0, 300)}`);
      return id;
    });

    const published = await step("the event reaches the Kafka topic", async () => {
      const m = await waitForMessage(
        TOPIC,
        since,
        (e) => e.eventType === "LearnerAssessmentStatusChanged" && e.data?.learnerId === learner.userId && e.data?.status === "Submitted",
        { timeoutMs: POLL_TIMEOUT_MS },
      );
      assert.ok(m, `no Submitted event for the learner within ${POLL_TIMEOUT_MS} ms (assessment OUTBOX_RELAY_ENABLED / topic?)`);
      assert.equal(m.event.data.courseId, courseId);
      assert.equal(m.event.data.assessmentId, assignmentId);
      assert.equal(m.event.data.kind, "ASSIGNMENT");
      assert.ok(m.event.data.firstActivityAt, "event has no firstActivityAt");
      return m;
    });
    const eventId = published.event.eventId;

    await step("J10a: enrollment moves NotStarted -> InProgress and first_activity_at equals the event's firstActivityAt", async () => {
      const row = await poll(
        "enrollment status",
        async () => {
          const me = expectStatus(await request("GET", `${GATEWAY}/api/v1/enrollments/me`, { token: learner.token }), 200);
          return data(me).items.find((i) => i.enrollmentId === enrollmentId);
        },
        (i) => i?.status === "InProgress",
      );
      assert.equal(row.status, "InProgress");
      const detail = await readAssignment();
      assert.equal(new Date(detail.firstActivityAt).getTime(), new Date(published.event.data.firstActivityAt).getTime(), `first_activity_at ${detail.firstActivityAt} vs event ${published.event.data.firstActivityAt}`);
    });

    // No business API exposes the outbox or the quarantine, so these two checks read SQL (read-only).
    await step("J10b: exactly one assessment outbox row for the submission, published, attempts 0; no quarantine row for the learner", async () => {
      const rows = await poll(
        "assessment outbox row",
        () => sql("assessment_db", `SELECT id, attempts, published_at IS NOT NULL AS published FROM outbox_events WHERE payload->>'learnerId' = ${literal(learner.userId)} AND event_type = 'LearnerAssessmentStatusChanged'`).split("\n").filter(Boolean),
        (r) => r.length > 0 && r.every((l) => l.endsWith("|t")),
      );
      assert.equal(rows.length, 1, `expected exactly 1 outbox row for the learner, got ${rows.length}: ${rows.join(" ; ")}`);
      const [id, attempts, published_] = rows[0].split("|");
      assert.equal(id, eventId, "outbox row id differs from the Kafka eventId");
      assert.equal(Number(attempts), 0);
      assert.equal(published_, "t");
      const quarantined = sql("learning_db", `SELECT count(*) FROM assessment_event_quarantine WHERE payload::text LIKE ${literal(`%${learner.userId}%`)} OR event_id = ${literal(eventId)}`);
      assert.equal(quarantined, "0", "learning quarantined an event of this learner");
    });

    await step("J10c: a byte-identical duplicate event is consumed and changes nothing", async () => {
      const before = await readAssignment();
      const startLag = groupLag(GROUP, TOPIC);
      produceMessage(TOPIC, learner.userId, published.raw);
      // Lag 0 after the duplicate was produced means learning has read and committed it.
      await poll("learning consumer lag after duplicate", async () => groupLag(GROUP, TOPIC), (lag) => lag === 0);
      // The consumer commits after its transaction; give a late status flip one more poll to show up.
      await sleep(1000);
      const after = await readAssignment();
      assert.equal(after.status, before.status);
      assert.equal(after.status, "InProgress");
      assert.equal(new Date(after.firstActivityAt).getTime(), new Date(before.firstActivityAt).getTime());
      const quarantined = sql("learning_db", `SELECT count(*) FROM assessment_event_quarantine WHERE event_id = ${literal(eventId)}`);
      assert.equal(quarantined, "0", `duplicate was quarantined (lag before duplicate: ${startLag})`);
      const rows = sql("assessment_db", `SELECT count(*) FROM outbox_events WHERE payload->>'learnerId' = ${literal(learner.userId)}`);
      assert.equal(rows, "1", "the duplicate must not create a second outbox row");
    });
  },
};
