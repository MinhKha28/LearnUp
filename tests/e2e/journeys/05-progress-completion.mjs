import { GATEWAY } from "../lib/config.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";
import { literal, sql } from "../lib/db.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default {
  id: "J5",
  title: "Learner opens curriculum, reports video/reading progress, completion is reflected",
  services: ["api-gateway", "learning", "course", "achievement-reporting", "kafka"],
  async run({ step, shared, skip }) {
    if (!shared.selfEnrollmentId) skip("no self-enrollment from J4");
    const { token } = shared.learner;
    const e = shared.selfEnrollmentId;
    const base = `${GATEWAY}/api/v1/enrollments/${e}`;
    const mat = "/api/v1/enrollments/:id/materials/:materialId";

    const curriculum = await step("curriculum lists required modules and lessons", async () => {
      const res = expectStatus(await request("GET", `${base}/curriculum`, { token, label: "/api/v1/enrollments/:id/curriculum" }), 200);
      assert.ok(data(res).modules.length > 0);
      return data(res);
    });
    const materials = await step("each lesson exposes its materials", async () => {
      const all = [];
      for (const m of curriculum.modules)
        for (const l of m.lessons) {
          const res = expectStatus(await request("GET", `${base}/lessons/${l.lessonId}`, { token, label: "/api/v1/enrollments/:id/lessons/:lessonId" }), 200);
          all.push(...data(res).materials.map((x) => ({ ...x, lessonId: l.lessonId })));
        }
      assert.ok(all.some((x) => x.isRequired && x.materialType === "Video"), "no required video");
      assert.ok(all.some((x) => x.isRequired && x.materialType === "Reading"), "no required reading");
      return all.filter((x) => x.isRequired);
    });
    await step("malformed progress report is rejected with 422", async () => {
      const video = materials.find((x) => x.materialType === "Video");
      expectStatus(
        await request("POST", `${base}/materials/${video.materialId}/progress`, { token, json: { ranges: [[5, 1]], positionSeconds: 1, reportedAt: "now" }, label: `${mat}/progress (invalid)` }),
        422,
      );
    });
    for (const m of materials) {
      if (m.materialType === "Video") {
        await step(`video ${m.title}: playback fixture, watched range completes it`, async () => {
          const play = expectStatus(await request("GET", `${base}/materials/${m.materialId}/playback`, { token, label: `${mat}/playback` }), 200);
          assert.ok(data(play), "empty playback response");
          const res = expectStatus(
            await request("POST", `${base}/materials/${m.materialId}/progress`, {
              token,
              json: { ranges: [[0, m.durationSeconds]], positionSeconds: m.durationSeconds, reportedAt: new Date().toISOString() },
              label: `${mat}/progress`,
            }),
            200,
          );
          assert.equal(data(res).completed, true);
          assert.ok(data(res).watchedSeconds >= data(res).requiredSeconds);
        });
      } else {
        await step(`reading ${m.title}: access fixture, completion recorded`, async () => {
          const access = expectStatus(await request("GET", `${base}/materials/${m.materialId}/reading-access`, { token, label: `${mat}/reading-access` }), 200);
          assert.ok(data(access).accessUrl, "no accessUrl");
          const res = expectStatus(await request("POST", `${base}/materials/${m.materialId}/complete-reading`, { token, label: `${mat}/complete-reading` }), 200);
          assert.ok(data(res).completedAt);
        });
      }
    }
    await step("curriculum reflects all required materials completed", async () => {
      const res = expectStatus(await request("GET", `${base}/curriculum`, { token, label: "/api/v1/enrollments/:id/curriculum" }), 200);
      assert.equal(data(res).requiredMaterials.completed, data(res).requiredMaterials.total);
      assert.ok(data(res).modules.every((m) => !m.isRequired || m.completed), "a required module is not completed");
    });
    await step(
      "enrollment becomes Completed (completion worker) within 30 s",
      async () => {
        let last;
        for (let i = 0; i < 30; i++) {
          const res = expectStatus(await request("GET", `${GATEWAY}/api/v1/enrollments/me`, { token }), 200);
          last = data(res).items.find((x) => x.enrollmentId === e);
          if (last?.status === "Completed") return;
          await sleep(1000);
        }
        assert.fail(`enrollment status is ${last?.status}, expected Completed`);
      },
    );
    await step("exactly one Issued certificate for the completed enrollment within 15 s, listed for the learner", async () => {
      // SQL: the learner certificate API lists certificates without their enrollment ID, so "one per enrollment" is read here.
      const rows = () =>
        sql("achievement_reporting_db", `SELECT id, status, coalesce(last_error, '') FROM certificates WHERE enrollment_id = ${literal(e)}`)
          .split("\n")
          .filter(Boolean)
          .map((line) => line.split("|"));
      let found = [];
      for (let i = 0; i < 30 && !(found.length === 1 && found[0][1] === "Issued"); i++) {
        await sleep(500);
        found = rows();
      }
      assert.ok(
        found.length === 1 && found[0][1] === "Issued",
        `enrollment ${e}: expected exactly 1 Issued certificate, found ${found.length ? found.map(([id, status, error]) => `${id} ${status}${error ? ` (${error})` : ""}`).join(", ") : "none"}`,
      );
      const list = expectStatus(await request("GET", `${GATEWAY}/api/v1/certificates/me`, { token }), 200);
      assert.ok(data(list).items.some((c) => c.id === found[0][0]), `certificate ${found[0][0]} of enrollment ${e} missing from /api/v1/certificates/me`);
    });
  },
};
