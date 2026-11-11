import { GATEWAY, SEED, loadClusterEnv } from "../lib/config.mjs";
import { login } from "../lib/actors.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";

const IDENTITY = process.env.E2E_IDENTITY_URL ?? "http://localhost:8081";
const ADMIN = { userId: "01900000-0000-7000-8000-000000000001", email: "admin@learnup.local", fullName: "Quản trị viên LearnUP" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reasonOf = (e) => {
  try {
    return JSON.parse(e.details)?.reason;
  } catch {
    return undefined;
  }
};
const trail = (token, query = "", label = "/api/v1/audit/logs") => request("GET", `${GATEWAY}/api/v1/audit/logs?${query}`, { token, label });

/** The Vietnam day (UTC+7) of an instant, and the instants that bound it, as the page of the audit trail sends them. */
const vietnamDay = (iso) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 10);
const dayStart = (day) => Date.parse(`${day}T00:00:00+07:00`);

export default {
  id: "J11",
  title: "UC50, UC51: an Organizer's action reaches the audit trail (tenant outbox -> relay -> audit-service), read as the Organizer, the Admin and another Organization",
  services: ["api-gateway", "identity", "tenant", "audit"],
  async run({ step, shared }) {
    const a = shared.organizers.a;
    const b = shared.organizers.b;
    const env = loadClusterEnv();
    const reason = `E2E ${shared.runId}`;
    let admin;
    let instructor;
    let entry;
    let actionAt;

    await step("the Admin can sign in (credential provisioned through Identity's internal channel, as the Organizers are)", async () => {
      const res = await request("POST", `${IDENTITY}/api/internal/credentials`, {
        headers: { "x-internal-key": env.INTERNAL_SERVICE_KEY },
        json: { userId: ADMIN.userId, password: env.FIXTURE_ORGANIZER_PASSWORD, email: ADMIN.email, fullName: ADMIN.fullName, role: "ADMIN" },
        label: "/api/internal/credentials (admin)",
      });
      expectStatus(res, [200, 201], "provision the Admin");
      admin = await login(ADMIN.email, env.FIXTURE_ORGANIZER_PASSWORD);
      assert.ok(admin, "no Admin token");
    });

    await step("the Organizer reads the audit trail through the gateway (200)", async () => {
      expectStatus(await trail(a.token), 200, "Organizer reads the trail");
    });

    await step("a real action: the Organizer deactivates an Instructor of the Organization, with a reason", async () => {
      const list = expectStatus(
        await request("GET", `${GATEWAY}/api/v1/users/instructors?status=Active&pageSize=20`, { token: a.token, label: "/api/v1/users/instructors" }),
        200,
        "list the Instructors",
      );
      const rows = data(list)?.items ?? [];
      assert.ok(rows.length >= 2, "the Organization needs two active Instructors (one to deactivate, one to take over)");
      actionAt = Date.now();
      for (const candidate of rows) {
        const others = rows.filter((row) => row.id !== candidate.id);
        const attempts = [{}, ...others.slice(0, 3).map((row) => ({ receiverInstructorId: row.id }))];
        for (const extra of attempts) {
          const res = await request("PATCH", `${GATEWAY}/api/v1/users/instructors/${candidate.id}/status`, {
            token: a.token,
            json: { action: "DEACTIVATE", reason, ...extra },
            label: "/api/v1/users/instructors/:id/status",
          });
          if (res.status === 200 && data(res)?.changed !== false) {
            instructor = candidate;
            return;
          }
        }
      }
      assert.fail("no Instructor could be deactivated");
    });

    await step("the action appears in the Organizer's trail, with who, what, on what, whose and why", async () => {
      for (let i = 0; i < 40 && !entry; i++) {
        const res = await trail(a.token, `targetResourceId=${instructor.id}`);
        // the entry of THIS run: an earlier run may have deactivated the same Instructor, and its entry is in the trail too
        entry = data(res)?.items?.find((e) => e.actionType === "INSTRUCTOR_DEACTIVATED" && reasonOf(e) === reason);
        if (!entry) await sleep(1000);
      }
      assert.ok(entry, "the entry never reached the audit trail (the tenant relay runs every second)");
      assert.equal(entry.actorUserId, SEED.organizerA.userId);
      assert.equal(entry.actorRole, "ORGANIZER");
      assert.equal(entry.targetResourceType, "User");
      assert.equal(entry.targetResourceId, instructor.id);
      assert.equal(entry.organizationId, SEED.organizerA.organizationId);
      assert.equal(reasonOf(entry), reason);
    });

    await step("the entry is dated by the time of the action (createdAt equals occurredAt, and it is the moment of the action)", async () => {
      const occurredAt = Date.parse(JSON.parse(entry.details).occurredAt);
      assert.equal(Date.parse(entry.createdAt), occurredAt, `createdAt ${entry.createdAt} is not occurredAt`);
      assert.ok(Math.abs(occurredAt - actionAt) < 30000, `the entry is ${(occurredAt - actionAt) / 1000} s from the action`);
    });

    await step("the day filter of the page finds it on the day of the action and not on another day", async () => {
      const day = vietnamDay(entry.createdAt);
      const from = new Date(dayStart(day)).toISOString();
      const to = new Date(dayStart(day) + 86400e3).toISOString();
      const found = data(await trail(a.token, `from=${from}&to=${to}&targetResourceId=${instructor.id}`));
      assert.ok(found?.items?.some((e) => e.id === entry.id), "not found on its own day");
      const other = data(await trail(a.token, `from=2020-01-01T00:00:00Z&to=2020-01-02T00:00:00Z&targetResourceId=${instructor.id}`));
      assert.equal(other?.totalElements, 0, "found on another day");
    });

    await step("UC51: the Admin reads the same entry, with its Organization", async () => {
      const found = data(await trail(admin, `targetResourceId=${instructor.id}`, "/api/v1/audit/logs (admin)"));
      const seen = found?.items?.find((e) => e.id === entry.id);
      assert.ok(seen, "the Admin does not see the entry");
      assert.equal(seen.organizationId, SEED.organizerA.organizationId);
    });

    await step("another Organization does not see it, and cannot ask for the Organization of the first one (403)", async () => {
      const own = data(await trail(b.token, `targetResourceId=${instructor.id}`, "/api/v1/audit/logs (org B)"));
      assert.equal(own?.totalElements, 0, "organization B sees organization A's entry");
      expectStatus(await trail(b.token, `organizationId=${SEED.organizerA.organizationId}`, "/api/v1/audit/logs (org B asks org A)"), 403, "org B asks for org A");
    });

    await step("reactivating the Instructor adds a second entry, newest first, without a reason", async () => {
      expectStatus(
        await request("PATCH", `${GATEWAY}/api/v1/users/instructors/${instructor.id}/status`, {
          token: a.token,
          json: { action: "REACTIVATE" },
          label: "/api/v1/users/instructors/:id/status",
        }),
        200,
        "reactivate",
      );
      let items = [];
      let reactivated;
      for (let i = 0; i < 40 && !reactivated; i++) {
        items = data(await trail(a.token, `targetResourceId=${instructor.id}`))?.items ?? [];
        reactivated = items.find((e) => e.actionType === "INSTRUCTOR_REACTIVATED" && Date.parse(e.createdAt) >= Date.parse(entry.createdAt));
        if (!reactivated) await sleep(1000);
      }
      assert.ok(reactivated, "the reactivation never reached the audit trail");
      // newest first: the reactivation of this run is listed before the deactivation of this run
      assert.ok(items.indexOf(reactivated) < items.findIndex((e) => e.id === entry.id), "not newest first");
      assert.ok(!reasonOf(reactivated), "the reactivation should have no reason");
    });

    await step("the list asks nothing the caller may not: reversed range 400, unknown sort ignored, page size capped at 100", async () => {
      expectStatus(await trail(a.token, "from=2026-11-05T00:00:00Z&to=2026-11-01T00:00:00Z", "/api/v1/audit/logs (reversed)"), 400, "reversed range");
      const sorted = expectStatus(await trail(a.token, "sort=nope,asc&size=3", "/api/v1/audit/logs (sort)"), 200, "unknown sort");
      const items = data(sorted).items;
      assert.ok(items.length < 2 || items[0].createdAt >= items[1].createdAt, "not newest first");
      const big = expectStatus(await trail(a.token, "size=100000", "/api/v1/audit/logs (size)"), 200, "huge page size");
      assert.ok(data(big).items.length <= 100 && data(big).size <= 100, "page size not capped");
    });

    await step("nobody writes through the gateway, and forged identity headers are replaced by the gateway", async () => {
      for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
        const res = await request(method, `${GATEWAY}/api/v1/audit/logs`, { token: admin, json: {}, label: `${method} /api/v1/audit/logs` });
        assert.ok([404, 405].includes(res.status), `${method} through the gateway answered ${res.status}`);
      }
      const forged = await request("GET", `${GATEWAY}/api/v1/audit/logs?size=1`, {
        token: b.token,
        headers: { "x-user-role": "ADMIN", "x-organization-id": SEED.organizerA.organizationId },
        label: "/api/v1/audit/logs (forged headers)",
      });
      expectStatus(forged, 200, "forged headers");
      assert.ok(data(forged).items.every((e) => e.organizationId === SEED.organizerB.organizationId), "forged headers widened the scope");
      expectStatus(await request("GET", `${GATEWAY}/api/v1/audit/logs`, { headers: { "x-user-role": "ADMIN" }, label: "/api/v1/audit/logs (no token)" }), 401, "no token");
    });
  },
};
