import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import {
  activeSubscription, configuration, extractMailToken, FixtureError, inspectInventory,
  manifest, organizations, provision, request, selectPlan, validateManifest, validateRuntime, verifyJwt,
} from "./demo-accounts.mjs";

function environment() {
  return { NODE_ENV: "test", DEMO_TARGET: "unit-only", DEMO_CONFIRM_ISOLATED: "learnup-demo-unit-only",
    DEMO_GATEWAY_URL: "http://127.0.0.1:18088", DEMO_MAILPIT_URL: "http://127.0.0.1:18025", DEMO_FRONTEND_URL: "http://127.0.0.1:13000",
    ...Object.fromEntries(["DEMO_DB_PASSWORD", "DEMO_JWT_SECRET", "DEMO_INTERNAL_KEY", "DEMO_OTP_SECRET", "DEMO_ACCOUNT_PASSWORD"].map((k) => [k, randomBytes(32).toString("hex")])) };
}
const config = configuration(environment());
const plan = { id: randomUUID(), name: "Disposable plan", price: 1, durationDays: 90, maxInstructors: 2, maxLearners: 5 };
const empty = () => ({ users: [], identity: [], organizations: [], subscriptions: [] });
const tenant = (data) => ({ statusCode: 200, data });
const identity = (data) => ({ success: true, data });
function jwt(user, algorithm = "HS512") {
  const header = Buffer.from(JSON.stringify({ alg: algorithm })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role.toUpperCase(), organizationId: user.organizationId, exp: Date.now() / 1000 + 900 })).toString("base64url");
  return `${header}.${payload}.${createHmac({ HS256: "sha256", HS384: "sha384", HS512: "sha512" }[algorithm], config.jwt).update(`${header}.${payload}`).digest("base64url")}`;
}

// Contract-level stateful adapters, not a stubbed provisioning result. These model
// individual HTTP effects only; the separate opt-in live test exercises real services.
function fixture() {
  const state = empty(), calls = [], passwords = new Map(), mail = new Map(), registrations = new Map(), invitations = new Map();
  let failEmail;
  function add(account, orgId, status = "Active", credentials = true) {
    const user = { id: randomUUID(), email: account.email, role: account.role, organizationId: orgId, status, deletedAt: null };
    state.users.push(user);
    if (credentials) {
      state.identity.push({ ...user, role: user.role.toUpperCase(), enabled: true }); passwords.set(user.email, config.password);
    }
    return user;
  }
  function subscribe(org) {
    state.subscriptions.push({ id: randomUUID(), organizationId: org.id, status: "Active", maxInstructors: 2, maxLearners: 5,
      startsAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() });
  }
  const api = async (endpoint, options = {}) => {
    calls.push({ endpoint, ...options });
    if (endpoint === "/api/v1/subscription-plans") return tenant([plan]);
    if (endpoint === "/api/v1/auth/login") {
      const u = state.users.find((u) => u.email === options.body.username);
      assert(u && passwords.get(u.email) === options.body.password, "unexpected password mutation or login");
      return identity({ user: { ...u, role: u.role.toUpperCase(), enabled: true }, accessToken: jwt(u), refreshToken: randomBytes(32).toString("hex") });
    }
    if (endpoint === "/api/v1/auth/logout") { assert(options.body.refreshToken); assert(!options.body.logoutAll); return identity({}); }
    if (endpoint === "/api/v1/users/me") {
      const claims = JSON.parse(Buffer.from(options.bearer.split(".")[1], "base64url"));
      const u = state.users.find((u) => u.id === claims.sub);
      return tenant({ ...u, organizationName: state.organizations.find((o) => o.id === u.organizationId)?.name ?? null });
    }
    if (endpoint === "/api/v1/registrations") {
      const { organizer, organization, planId } = options.body;
      assert.equal(planId, plan.id); assert.equal(organizer.password, config.password);
      const account = manifest.find((a) => a.email === organizer.email);
      assert.equal(organization.name, account.organization);
      const org = { id: randomUUID(), name: organization.name, status: "PendingPayment" }; state.organizations.push(org);
      const user = add(account, org.id, "Pending");
      const token = randomBytes(32).toString("base64url"); registrations.set(token, { org, user, verified: false }); mail.set(user.email, token);
      return tenant({ email: user.email });
    }
    if (endpoint.startsWith("/api/v1/registrations/") && !options.body) {
      const registration = registrations.get(endpoint.split("/").at(-1)); registration.verified = true;
      return tenant({ organizerEmail: registration.user.email, organizationName: registration.org.name, status: "PendingPayment", plan });
    }
    if (endpoint === "/api/v1/registrations/payments") {
      const registration = registrations.get(options.body.token); assert(registration.verified, "payment must follow email verification");
      registration.org.status = "Active"; registration.user.status = "Active"; subscribe(registration.org);
      return tenant({ paymentStatus: "Succeeded" });
    }
    if (/^\/api\/v1\/users\/(instructors|learners)(\/seats)?$/.test(endpoint)) {
      const claims = JSON.parse(Buffer.from(options.bearer.split(".")[1], "base64url"));
      assert.equal(claims.role, "ORGANIZER");
      if (endpoint.endsWith("/seats")) return tenant({ canCreate: true, subscriptionStatus: "Active", remaining: 1 });
      const account = manifest.find((a) => a.email === options.body.email);
      assert.equal(account.role, endpoint.endsWith("instructors") ? "Instructor" : "Learner");
      const user = add(account, claims.organizationId, "Pending", false);
      const token = randomBytes(32).toString("base64url"); invitations.set(token, user); mail.set(user.email, token);
      return tenant(user);
    }
    if (endpoint.startsWith("/api/v1/invitations/") && !options.body) {
      const u = invitations.get(endpoint.split("/").at(-1));
      return tenant({ ...u, organizationName: state.organizations.find((o) => o.id === u.organizationId).name });
    }
    if (endpoint === "/api/v1/invitations/accept") {
      const u = invitations.get(options.body.token); assert.equal(u.status, "Pending");
      u.status = "Active"; passwords.set(u.email, options.body.password); state.identity.push({ ...u, role: u.role.toUpperCase(), enabled: true });
      return tenant({ email: u.email, role: u.role });
    }
    throw new Error("unexpected endpoint");
  };
  return { state, calls, add, passwords, subscribe, api,
    failMail: (email) => { failEmail = email; },
    read: async () => structuredClone(state), receive: async (email) => {
      if (email === failEmail) throw new Error(`do not print ${config.password} ${mail.get(email)}`);
      assert(mail.has(email)); return mail.get(email);
    } };
}
async function run(f, options = {}) { return provision(config, { mode: "provision", allowMissingAdmin: true, ...f, ...options }); }

test("manifest has exactly 17, correct roles and two Organizations; Admin has no Organization", () => {
  validateManifest(); assert.equal(manifest.length, 17);
  assert.deepEqual(["Admin", "Organizer", "Instructor", "Learner"].map((r) => manifest.filter((a) => a.role === r).length), [1, 2, 4, 10]);
});
test("manifest rejects duplicate identities, wrong domain and wrong roles", () => {
  for (const modify of [(a) => { a[1].email = a[0].email; }, (a) => { a[1].email = "person@example.com"; }, (a) => { a[2].role = "Admin"; }]) {
    const accounts = structuredClone(manifest); modify(accounts); assert.throws(() => validateManifest(accounts), FixtureError);
  }
});
for (const [name, patch] of [
  ["production Node environment", { NODE_ENV: "production" }], ["missing environment", { NODE_ENV: "" }],
  ["production Spring profile", { SPRING_PROFILES_ACTIVE: "production" }], ["Docker deployment profile", { SPRING_PROFILES_ACTIVE: "docker" }],
  ["production-like target", { DEMO_TARGET: "prod-db" }], ["missing isolation acknowledgement", { DEMO_CONFIRM_ISOLATED: "" }],
  ["external Gateway", { DEMO_GATEWAY_URL: "https://learnup.com" }], ["external SMTP", { DEMO_MAILPIT_URL: "http://smtp.example.test:8025" }],
  ["credential-bearing URL", { DEMO_GATEWAY_URL: "http://user:secret@127.0.0.1:18088" }], ["missing password", { DEMO_ACCOUNT_PASSWORD: "" }],
  ["missing internal key", { DEMO_INTERNAL_KEY: "" }], ["repository default", { DEMO_INTERNAL_KEY: "learnup-internal-secret-key-change-me" }],
]) test(`safety rejects ${name} without exposing values`, () => {
  assert.throws(() => configuration({ ...environment(), ...patch }), (e) => e instanceof FixtureError && !JSON.stringify(e).includes("user:secret"));
});

function runtime() {
  const network = { Id: "disposable-network", Internal: true, Labels: { "com.learnup.demo-fixture": config.target } };
  const ingress = { Id: "disposable-ingress", Internal: false, Labels: { "com.learnup.demo-fixture": config.target } };
  const java = { SPRING_PROFILES_ACTIVE: "development", EUREKA_CLIENT_SERVICEURL_DEFAULTZONE: "http://eureka-server:8761/eureka/" };
  const db = { SPRING_DATASOURCE_USERNAME: "fixture", SPRING_DATASOURCE_PASSWORD: config.dbPassword };
  const auth = { INTERNAL_SERVICE_KEY: config.internalKey, JWT_SECRET: config.jwt, TENANT_SERVICE_URL: "http://tenant-service:8084" };
  const envs = {
    postgres: { POSTGRES_USER: "fixture", POSTGRES_PASSWORD: config.dbPassword }, smtp: {}, "eureka-server": java,
    "api-gateway": { ...java, ...auth },
    "identity-service": { ...java, ...db, ...auth, SPRING_DATASOURCE_URL: "jdbc:postgresql://postgres:5432/learnup_demo_identity", LEARNUP_SEED_ENABLED: "false", NOTIFICATION_SERVICE_URL: "http://notification-service:8082", PASSWORD_RECOVERY_FRONTEND_BASE_URL: config.frontend },
    "notification-service": { ...java, ...db, INTERNAL_SERVICE_KEY: config.internalKey, SPRING_DATASOURCE_URL: "jdbc:postgresql://postgres:5432/learnup_demo_notification", LEARNUP_MAIL_ENABLED: "true", SPRING_MAIL_HOST: "smtp", SPRING_MAIL_PORT: "1025", SPRING_MAIL_SMTP_AUTH: "false", SPRING_MAIL_SMTP_STARTTLS_ENABLE: "false" },
    "tenant-service": { NODE_ENV: "development", DEV_FAKE_AUTH: "false", INTERNAL_SERVICE_KEY: config.internalKey, EMAIL_OTP_SECRET: config.otp, DATABASE_URL: `postgresql://fixture:${config.dbPassword}@postgres:5432/learnup_demo_tenant`, IDENTITY_SERVICE_URL: "http://identity-service:8081", NOTIFICATION_SERVICE_URL: "http://notification-service:8082", FRONTEND_URL: config.frontend },
  };
  const containers = Object.entries(envs).map(([service, env]) => ({ Id: service, State: { Running: true }, Mounts: [],
    Config: { Image: service === "smtp" ? "axllent/mailpit:v1.27.4" : "test-only", Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      Labels: { "com.docker.compose.service": service, "com.docker.compose.project": config.project, "com.learnup.demo-fixture": config.target } },
    NetworkSettings: { Networks: { fixture: { NetworkID: network.Id }, ...(["smtp", "api-gateway"].includes(service) ? { ingress: { NetworkID: ingress.Id } } : {}) }, Ports: service === "api-gateway" ? { "8080/tcp": [{ HostIp: "127.0.0.1", HostPort: "18088" }] } : service === "smtp" ? { "8025/tcp": [{ HostIp: "127.0.0.1", HostPort: "18025" }] } : {} } }));
  return { containers, network, ingress };
}
test("matching isolated runtime is accepted", () => { const r = runtime(); assert(validateRuntime(config, r.containers, r.network, r.ingress)); });
for (const [name, modify] of [
  ["shared project", (r) => { r.containers[0].Config.Labels["com.docker.compose.project"] = "learnup"; }],
  ["shared volume", (r) => { r.containers[0].Mounts.push({ Type: "volume", Name: "shared" }); }],
  ["external network", (r) => { r.network.Internal = false; }],
  ["second network", (r) => { r.containers[0].NetworkSettings.Networks.other = { NetworkID: "shared" }; }],
  ["SMTP forwarding", (r) => { r.containers[1].Config.Env.push("MP_SMTP_RELAY_HOST=external"); }],
  ["public host binding", (r) => { r.containers[3].NetworkSettings.Ports["8080/tcp"][0].HostIp = "0.0.0.0"; }],
  ["wrong internal key", (r) => { r.containers[4].Config.Env = r.containers[4].Config.Env.filter((e) => !e.startsWith("INTERNAL_SERVICE_KEY=")); }],
  ["mock SMTP", (r) => { r.containers[5].Config.Env = r.containers[5].Config.Env.map((e) => e === "LEARNUP_MAIL_ENABLED=true" ? "LEARNUP_MAIL_ENABLED=false" : e); }],
  ["wrong database", (r) => { r.containers[6].Config.Env = r.containers[6].Config.Env.map((e) => e.startsWith("DATABASE_URL=") ? "DATABASE_URL=postgresql://shared/tenant_db" : e); }],
  ["fake Organizer authentication", (r) => { r.containers[6].Config.Env = r.containers[6].Config.Env.map((e) => e === "DEV_FAKE_AUTH=false" ? "DEV_FAKE_AUTH=true" : e); }],
]) test(`runtime refuses ${name}`, () => { const r = runtime(); modify(r); assert.throws(() => validateRuntime(config, r.containers, r.network, r.ingress), FixtureError); });

test("dry-run makes no account mutations, logins, payments or email calls", async () => {
  const f = fixture(), result = await run(f, { mode: "dry-run" });
  assert.equal(result.results.filter((a) => a.status === "would-create").length, 16);
  assert.equal(result.results[0].reason, "ADMIN_BOOTSTRAP_UNAVAILABLE"); assert.deepEqual(f.state, empty());
  assert.deepEqual(f.calls.map((c) => c.endpoint), ["/api/v1/subscription-plans"]);
});
test("missing Admin blocks mutations unless explicitly accepting 16-account mode", async () => {
  const f = fixture(); const result = await run(f, { allowMissingAdmin: false });
  assert.match(result.error, /^ADMIN_BOOTSTRAP/); assert.deepEqual(f.state, empty());
});
test("16 legitimate Organization workflows, matching IDs, login checks, then idempotent rerun", async () => {
  const f = fixture(), result = await run(f);
  assert(!result.error); assert(!result.complete); assert.equal(result.results.filter((a) => a.status === "created").length, 16);
  assert.equal(f.state.organizations.length, 2); assert.equal(f.state.users.length, 16); assert.equal(f.state.identity.length, 16);
  const before = JSON.stringify(f.state), calls = f.calls.length, passwords = [...f.passwords];
  const rerun = await run(f); assert(!rerun.error); assert.equal(rerun.results.filter((a) => a.status === "existing").length, 16);
  assert.equal(JSON.stringify(f.state), before); assert.deepEqual([...f.passwords], passwords);
  assert(f.calls.slice(calls).every((c) => !c.method || ["/api/v1/auth/login", "/api/v1/auth/logout"].includes(c.endpoint)));
});
test("a legitimately pre-existing platform Admin is verified without provisioning or Organization membership", async () => {
  const f = fixture(); f.add(manifest[0], null);
  const result = await run(f); assert(result.complete); assert.equal(f.state.users.length, 17);
  assert.equal(f.state.users[0].organizationId, null); assert.equal(result.results[0].status, "existing");
  assert(f.calls.every((c) => c.endpoint !== "/api/internal/credentials" && c.endpoint !== "/api/v1/auth/register"));
});
for (const [name, modify] of [
  ["disabled", (s) => { s.users[0].status = "Deactivated"; }], ["deleted", (s) => { s.users[0].deletedAt = new Date().toISOString(); }],
  ["wrong role", (s) => { s.users[0].role = "Learner"; }], ["wrong canonical ID", (s) => { s.identity[0].id = randomUUID(); }],
  ["fabricated Admin Organization", (s) => { s.identity[0].organizationId = randomUUID(); }],
  ["Identity orphan", (s) => { s.users.length = 0; }], ["disabled credentials", (s) => { s.identity[0].enabled = false; }],
]) test(`existing ${name} fails without repair`, async () => {
  const f = fixture(); f.add(manifest[0], null); modify(f.state);
  const before = JSON.stringify(f.state), result = await run(f);
  assert.equal(result.error, "EXISTING_ACCOUNT_CONFLICT"); assert.equal(f.calls.length, 0); assert.equal(JSON.stringify(f.state), before);
});
test("non-fixture account data refuses all writes and remains untouched", async () => {
  const f = fixture(); f.state.users.push({ email: "someone@example.com" }); const before = JSON.stringify(f.state);
  assert.equal((await run(f)).error, "NON_FIXTURE_DATA_REFUSED"); assert.equal(f.calls.length, 0); assert.equal(JSON.stringify(f.state), before);
});
test("existing changed password is never replaced", async () => {
  const f = fixture(); f.add(manifest[0], null); f.passwords.set(manifest[0].email, randomBytes(32).toString("hex"));
  const before = [...f.passwords]; const result = await run(f); assert(result.error); assert.deepEqual([...f.passwords], before); assert.equal(f.state.users.length, 1);
});
test("wrong login identity cannot be used to invite accounts", async () => {
  const f = fixture(); f.add(manifest[0], null);
  f.api = async (endpoint) => endpoint.endsWith("subscription-plans") ? tenant([plan]) : identity({ user: { id: "incorrect" } });
  assert.equal((await run(f)).error, "LOGIN_CONTEXT_MISMATCH"); assert.equal(f.state.users.length, 1);
});
test("eligible plan and subscription quotas are checked", () => {
  assert.equal(selectPlan([plan]).id, plan.id);
  assert.throws(() => selectPlan([{ ...plan, maxLearners: 4 }]), /NO_ELIGIBLE_PLAN/);
  const snapshot = { subscriptions: [{ ...plan, organizationId: "org", status: "Active", startsAt: new Date(0), expiresAt: new Date(Date.now() - 1) }] };
  assert.throws(() => activeSubscription(snapshot, "org"), /SUBSCRIPTION_CONFLICT/);
});
test("no available seat blocks an invitation rather than bypassing Tenant", async () => {
  const f = fixture(), real = f.api;
  f.api = (endpoint, opts) => endpoint.endsWith("/seats") ? tenant({ remaining: 0, canCreate: false, subscriptionStatus: "Active" }) : real(endpoint, opts);
  assert.equal((await run(f)).error, "SEAT_QUOTA_BLOCKED"); assert.equal(f.state.users.length, 1);
});
test("mail failure retains partial progress, redacts secrets, and a rerun does not reset or resend", async () => {
  const f = fixture(); f.failMail(manifest[2].email);
  const result = await run(f); assert(result.error); assert.equal(result.results[1].status, "created"); assert.equal(result.results[2].status, "pending");
  assert(!JSON.stringify(result).includes(config.password)); assert(!JSON.stringify(result).includes("http"));
  const before = f.calls.length; const again = await run(f); assert.equal(again.error, "EXISTING_ACCOUNT_CONFLICT"); assert.equal(f.calls.length, before);
});
test("pending registration is not recreated or silently activated after SMTP failure", async () => {
  const f = fixture(); f.failMail(manifest[1].email);
  const first = await run(f); assert.equal(first.results[1].status, "pending");
  const before = JSON.stringify(f.state), calls = f.calls.length;
  const again = await run(f); assert.equal(again.error, "EXISTING_ACCOUNT_CONFLICT");
  assert.equal(again.results[1].status, "blocked");
  assert.equal(JSON.stringify(f.state), before); assert.equal(f.calls.length, calls);
});
test("cross-Organization membership conflicts are not repaired", async () => {
  const f = fixture(); assert(!(await run(f)).error);
  f.state.users.find((u) => u.email === manifest[2].email).organizationId = f.state.organizations[1].id;
  const before = JSON.stringify(f.state), calls = f.calls.length;
  assert.equal((await run(f)).error, "EXISTING_ACCOUNT_CONFLICT");
  assert.equal(JSON.stringify(f.state), before); assert.equal(f.calls.length, calls);
});
test("expired or quota-reduced Subscriptions block reruns without renewal or writes", async () => {
  for (const patch of [{ expiresAt: new Date(0).toISOString() }, { maxLearners: 4 }, { status: "Suspended" }]) {
    const f = fixture(); assert(!(await run(f)).error); Object.assign(f.state.subscriptions[0], patch);
    const before = JSON.stringify(f.state), calls = f.calls.length;
    assert.equal((await run(f)).error, "SUBSCRIPTION_CONFLICT");
    assert.equal(JSON.stringify(f.state), before); assert.equal(f.calls.length, calls);
  }
});
test("HTTP-success business failure is not mistaken for successful registration", async () => {
  const f = fixture(), api = f.api;
  f.api = (endpoint, options) => endpoint === "/api/v1/registrations"
    ? { statusCode: 400, message: config.password } : api(endpoint, options);
  const result = await run(f); assert.equal(result.error, "API_OPERATION_REJECTED"); assert.deepEqual(f.state, empty());
  assert(!JSON.stringify(result).includes(config.password)); assert.equal(result.results[1].status, "blocked");
});
test("status is read-only and distinguishes missing and present without pretending login verification", async () => {
  const f = fixture(); f.add(manifest[0], null); const result = await run(f, { mode: "status" });
  assert.equal(result.results[0].status, "existing"); assert.equal(result.results[1].status, "missing"); assert.equal(f.calls.length, 0);
});
test("SMTP extracts only trusted frontend links; tokens never enter diagnostic errors", () => {
  const token = randomBytes(32).toString("base64url");
  assert.equal(extractMailToken({ HTML: `<a href="${config.frontend}/register/pending-payment?token=${token}">Continue</a>` }, config, "registration"), token);
  assert.equal(extractMailToken({ Text: `${config.frontend}/activate/${token}` }, config, "invitation"), token);
  assert.throws(() => extractMailToken({ Text: `http://evil.example/activate/${token}` }, config, "invitation"), (e) => e.code === "EXPECTED_MAIL_LINK_MISSING" && !e.message.includes(token));
});
test("JWT signatures and canonical Organization/role mapping are verified for supported HMAC algorithms", () => {
  const user = { id: randomUUID(), role: "Instructor", organizationId: randomUUID() };
  for (const algorithm of ["HS256", "HS384", "HS512"]) verifyJwt(jwt(user, algorithm), config, user);
  assert.throws(() => verifyJwt(jwt(user), config, { ...user, role: "Admin" }), /JWT_CONTEXT_MISMATCH/);
  assert.throws(() => verifyJwt(jwt(user), { ...config, jwt: "wrong" }, user), /JWT_CONTEXT_MISMATCH/);
});
test("real HTTP adapter sends exact DTO and no internal/user headers; HTTP errors are redacted", async () => {
  const received = [], server = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    received.push({ url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/error") { res.statusCode = 500; res.end(JSON.stringify({ secret: config.password })); }
    else res.end(JSON.stringify(tenant({})));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const body = { fullName: "Demo Instructor", email: manifest[2].email };
    await request(url, "/api/v1/users/instructors", { method: "POST", body, bearer: "test-bearer" });
    assert.equal(received[0].url, "/api/v1/users/instructors"); assert.deepEqual(received[0].body, body);
    assert.equal(received[0].headers.authorization, "Bearer test-bearer");
    for (const h of ["x-internal-key", "x-user-id", "x-user-role", "x-organization-id"]) assert.equal(received[0].headers[h], undefined);
    await assert.rejects(() => request(url, "/error"), (e) => e.code === "HTTP_500" && !e.message.includes(config.password));
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
