import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { configuration, databaseReader, ensureReady, inspectInventory, inspectRuntime, manifest, request } from "./demo-accounts.mjs";

const exec = promisify(execFile);
const directory = import.meta.dirname;
async function freePort() {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = server.address().port; await new Promise((resolve) => server.close(resolve)); return port;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// This test owns only its randomly named Compose project. It never uses root
// Compose, .env, shared volumes, host databases, or an existing fixture target.
test("real disposable Tenant/Gateway/Identity/Notification/PostgreSQL/SMTP provisioning and rerun", {
  skip: process.env.LEARNUP_DEMO_INTEGRATION !== "true", timeout: 1800000,
}, async (t) => {
  const target = `verify-${randomBytes(5).toString("hex")}`;
  const gatewayPort = String(await freePort()), mailPort = String(await freePort());
  const env = { ...process.env, NODE_ENV: "test", DEMO_TARGET: target, DEMO_CONFIRM_ISOLATED: `learnup-demo-${target}`,
    DEMO_GATEWAY_PORT: gatewayPort, DEMO_MAILPIT_PORT: mailPort, DEMO_GATEWAY_URL: `http://127.0.0.1:${gatewayPort}`,
    DEMO_MAILPIT_URL: `http://127.0.0.1:${mailPort}`, DEMO_FRONTEND_URL: `http://127.0.0.1:${await freePort()}`,
    SPRING_PROFILES_ACTIVE: "test",
    ...Object.fromEntries(["DEMO_DB_PASSWORD", "DEMO_JWT_SECRET", "DEMO_INTERNAL_KEY", "DEMO_OTP_SECRET", "DEMO_ACCOUNT_PASSWORD"].map((key) => [key, randomBytes(32).toString("hex")])) };
  const config = configuration(env);
  const compose = async (...args) => {
    try { return await exec("docker", ["compose", "-f", path.join(directory, "compose.yml"), ...args],
      { env, windowsHide: true, timeout: 1200000, maxBuffer: 32 * 1024 * 1024 }); }
    catch { throw new Error(`Disposable Compose operation failed: ${args[0]}`); }
  };
  const cli = async (...args) => {
    let output;
    try { const result = await exec(process.execPath, [path.join(directory, "demo-accounts.mjs"), ...args],
      { env, windowsHide: true, timeout: 180000, maxBuffer: 1024 * 1024 }); output = { code: 0, stdout: result.stdout }; }
    catch (e) { output = { code: e.code, stdout: e.stdout ?? "" }; }
    for (const key of ["DEMO_DB_PASSWORD", "DEMO_JWT_SECRET", "DEMO_INTERNAL_KEY", "DEMO_OTP_SECRET", "DEMO_ACCOUNT_PASSWORD"]) {
      assert(!output.stdout.includes(env[key]), "CLI leaked a secret");
    }
    return { code: output.code, rows: output.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) };
  };
  let phase = "build";
  const heartbeat = setInterval(() => console.log(`Disposable fixture verification: ${phase}`), 20000);
  try {
    await compose("config", "--quiet");
    await compose("build");
    phase = "start"; await compose("up", "-d");
    let services;
    for (let attempt = 0; attempt < 90; attempt++) {
      try { services = await inspectRuntime(config); break; } catch { await sleep(1000); }
    }
    assert(services, "Isolated runtime safety verification did not succeed");
    phase = "wait for migrations and discovery";
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        const plans = await request(config.gateway, "/api/v1/subscription-plans");
        await databaseReader(services.postgres)();
        await ensureReady(config, services);
        if (plans.statusCode === 200) { ready = true; break; }
      } catch { /* A GET can safely be retried while services start. */ }
      await sleep(1000);
    }
    assert(ready, "Migrations/discovery were not ready");
    // Existing Tenant reference-only seed: no users, Organizations or credentials.
    await compose("exec", "-T", "tenant-service", "npm", "run", "prisma:seed");
    const read = databaseReader(services.postgres);
    const before = await read(); assert.equal(before.users.length, 0); assert.equal(before.identity.length, 0);
    phase = "dry-run and Admin guard";
    await t.test("real dry-run: 16 planned, Admin blocked, no account writes", async () => {
      const dry = await cli("--dry-run"); assert.equal(dry.code, 2);
      assert.equal(dry.rows.at(-1).counts["would-create"], 16);
      assert.deepEqual(await read(), before);
      const guarded = await cli("--provision"); assert.equal(guarded.code, 1);
      assert.deepEqual(await read(), before);
    });
    phase = "16 account business workflows";
    let provisioned = false;
    await t.test("real registration, email verification, payment, invitations and all 16 logins", async () => {
      const result = await cli("--provision", "--allow-missing-admin");
      console.log(`Provisioning summary: ${JSON.stringify(result.rows.at(-1))}`);
      if (result.rows.at(-1).error) {
        // Diagnose only a known constraint name. Never echo application logs:
        // upstream errors can contain sensitive bodies, SQL parameters or URLs.
        const logs = await exec("docker", ["logs", services["identity-service"].Id],
          { windowsHide: true, timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
        const duplicateUsername = /duplicate key value violates unique constraint ["']users_username_key["']/.test(`${logs.stdout}\n${logs.stderr}`);
        const snapshot = await read();
        console.log(JSON.stringify({ diagnostic: "IDENTITY_PROVISIONING", duplicateUsernameConstraint: duplicateUsername,
          canonicalAccounts: snapshot.users.length, credentialAccounts: snapshot.identity.length,
          pendingAccounts: snapshot.users.filter((u) => u.status === "Pending").length }));
      }
      assert.equal(result.code, 2, "Missing Admin must remain explicit");
      assert.equal(result.rows.at(-1).error, null, "Business workflow failed (redacted; inspect isolated state)");
      assert.equal(result.rows.at(-1).counts.created, 16);
      const snapshot = await read(), inventory = inspectInventory(snapshot);
      assert.equal(inventory.slice(1).filter((a) => a.state === "existing").length, 16);
      assert.equal(snapshot.users.length, 16); assert.equal(snapshot.identity.length, 16); assert.equal(snapshot.organizations.length, 2);
      for (const org of snapshot.organizations) {
        assert.equal(snapshot.users.filter((u) => u.organizationId === org.id).length, 8);
        assert.equal(snapshot.subscriptions.find((s) => s.organizationId === org.id).status, "Active");
      }
      provisioned = true;
    });
    assert(provisioned, "Remaining live scenarios require successful provisioning");
    phase = "SMTP and idempotency";
    await t.test("real SMTP received messages for all 16 provisioned identities", async () => {
      const messages = await request(config.smtp, "/api/v1/messages?limit=500");
      for (const account of manifest.slice(1)) assert(messages.messages.some((m) => m.To.some((to) => to.Address === account.email)), "Fixture email missing");
      console.log(`Disposable SMTP messages observed: ${messages.total}`);
    });
    await t.test("second real execution creates no duplicates and does not change account metadata or send more emails", async () => {
      const snapshot = await read(), mail = await request(config.smtp, "/api/v1/messages?limit=500");
      const result = await cli("--provision", "--allow-missing-admin");
      assert.equal(result.code, 2); assert.equal(result.rows.at(-1).error, null); assert.equal(result.rows.at(-1).counts.existing, 16);
      assert.deepEqual(await read(), snapshot);
      assert.equal((await request(config.smtp, "/api/v1/messages?limit=500")).total, mail.total);
    });
    await t.test("status performs no account writes", async () => {
      const snapshot = await read(), status = await cli("--status");
      assert.equal(status.code, 2); assert.equal(status.rows.at(-1).counts.existing, 16); assert.deepEqual(await read(), snapshot);
    });
    phase = "changed-password preservation";
    await t.test("a deliberately changed fixture password is preserved and rerun fails safely", async () => {
      const email = manifest[1].email, changed = randomBytes(32).toString("hex");
      const login = await request(config.gateway, "/api/v1/auth/login", { method: "POST", body: { username: email, password: config.password } });
      const change = await request(config.gateway, "/api/v1/auth/change-password", { method: "POST", bearer: login.data.accessToken,
        body: { currentPassword: config.password, newPassword: changed, confirmPassword: changed } });
      assert.equal(change.success, true);
      const snapshot = await read(), result = await cli("--provision", "--allow-missing-admin");
      assert.equal(result.code, 1); assert.equal(result.rows.at(-1).error, "HTTP_401"); assert.deepEqual(await read(), snapshot);
      const valid = await request(config.gateway, "/api/v1/auth/login", { method: "POST", body: { username: email, password: changed } });
      assert.equal(valid.success, true);
      await request(config.gateway, "/api/v1/auth/logout", { method: "POST", bearer: valid.data.accessToken, body: { refreshToken: valid.data.refreshToken } });
    });
  } finally {
    phase = "cleanup";
    try { await compose("down", "--volumes", "--remove-orphans", "--rmi", "local"); }
    finally { clearInterval(heartbeat); }
  }
});
